"use client";

import { useEffect, useRef, useState } from "react";
import { autosaveResponse } from "./autosave";
import {
  enqueue,
  resolve,
  pending,
  pendingCount,
  type OutboxEntry,
  type OutboxPayload,
} from "@/lib/offline/outbox";
import { readLastValues, saveLastValue } from "@/lib/offline/lastValues";

type Props = {
  visitId: string;
  /** id del <form> de respuestas al que engancharse. */
  formId: string;
  /** solo activo mientras la visita está en progreso (no completada). */
  enabled: boolean;
};

type FieldPayload = OutboxPayload;

const DEBOUNCE_TEXT = 1200; // texto/número: espera a que deje de escribir
const DEBOUNCE_CHOICE = 250; // radio/checkbox: casi inmediato
const RESYNC_INTERVAL = 15000; // reintento periódico de la cola offline (ms)
const RESYNC_MAX = 120000; // techo del backoff cuando la subida viene fallando
const SEND_TIMEOUT = 25000; // deja de ESPERAR un envío colgado (no lo cancela)

/**
 * Autosave DURABLE del formulario del técnico (offline-first).
 *
 * Antes: cada cambio se mandaba directo al server (server action). En sótanos/fosos
 * sin señal la llamada fallaba y la respuesta se PERDÍA — no quedaba nada local.
 *
 * Ahora: cada cambio se guarda PRIMERO en el equipo (outbox en localStorage, que
 * sobrevive recarga y cierre de app) y recién después se intenta subir. Si no hay
 * señal, queda en la cola y se re-sincroniza solo cuando vuelve la conexión
 * (evento `online`), al reintento periódico, o al volver a abrir la visita.
 * Al montar, rehidrata el formulario con lo pendiente para que el técnico VEA lo
 * que ya respondió aunque el server nunca lo haya recibido.
 */
const isOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false;

export default function AutosaveManager({ visitId, formId, enabled }: Props) {
  const [status, setStatus] = useState<
    "idle" | "saving" | "saved" | "offline" | "error"
  >("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pendingN, setPendingN] = useState(0);
  const timers = useRef<Map<string, number>>(new Map());
  // Handle al ÚNICO drenador (efecto de abajo). El efecto de captura lo llama en
  // vez de tener su propia copia.
  const drenarRef = useRef<() => void>(() => {});

  // ⚠️ DRENADOR ÚNICO de la cola. Corre AUNQUE la visita ya esté completada.
  //
  // Corre siempre (bug del 3-ago-2026): el efecto de captura arranca con
  // `if (!enabled) return` y `enabled = !isCompleted`, así que al completar una
  // visita se cortaba el drenado y las respuestas de la cola no subían nunca.
  //
  // Y es ÚNICO (bug del 4-ago-2026, PH MATISSE, reportado por William):
  // antes había DOS drenadores —este y un `drainAll` dentro del efecto de
  // captura— cada uno con su `setInterval` de 15 s y ninguno con guard de
  // in-flight. Los server actions de Next se despachan por una sola cola FIFO
  // (`action-queue.js`: si hay una pendiente, la nueva se encola), así que en una
  // escalera sin señal —donde un pase tarda MÁS de 15 s— cada tick apilaba dos
  // pases nuevos que reenviaban las MISMAS entradas. La cola se llenaba de
  // reenvíos redundantes y las respuestas nuevas quedaban atrás en la fila: el
  // técnico veía "Guardando…" clavado y 44 respuestas sin subir, ya con señal.
  // El guard `drenando` es el arreglo de fondo: nunca más de un envío en vuelo.
  useEffect(() => {
    let vivo = true;
    let timer: number | undefined;
    let drenando = false;
    let espera = RESYNC_INTERVAL;

    // Sube UNA entrada. `SEND_TIMEOUT` no cancela el request (un server action no
    // es abortable): solo deja de esperarlo para que un envío colgado no congele
    // el indicador ni el backoff. Reintentar es inocuo: el upsert cae en la misma
    // fila por `client_token`.
    const subir = async (entry: OutboxEntry): Promise<boolean> => {
      try {
        const res = await Promise.race([
          autosaveResponse({ visitId, ...entry.payload }),
          new Promise<null>((r) => window.setTimeout(() => r(null), SEND_TIMEOUT)),
        ]);
        if (res?.ok) {
          resolve(entry.key, entry.ts);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    const drenar = async () => {
      if (drenando) return; // ← el guard que evita la avalancha
      const items = pending(visitId);
      if (items.length === 0) {
        espera = RESYNC_INTERVAL;
        if (vivo) setPendingN(0);
        return;
      }
      if (isOffline()) {
        if (vivo) setStatus("offline");
        return;
      }
      drenando = true;
      if (vivo) setStatus("saving");
      let hubeFallo = false;
      try {
        for (const entry of items) {
          // eslint-disable-next-line no-await-in-loop
          const ok = await subir(entry);
          if (!vivo) return;
          // El contador baja en vivo: sin esto el técnico ve un número congelado
          // y cree que no avanza (fue justo lo que reportó William).
          setPendingN(pendingCount(visitId));
          if (ok) continue;
          if (isOffline()) break; // se cayó la señal: el resto queda en cola
          // Falló con señal. NO cortamos el pase: una sola entrada que el server
          // rechace siempre trancaba la cola entera para siempre.
          hubeFallo = true;
        }
      } finally {
        drenando = false;
      }
      if (!vivo) return;
      const quedan = pendingCount(visitId);
      setPendingN(quedan);
      if (quedan === 0) {
        espera = RESYNC_INTERVAL;
        setSavedAt(new Date());
        setStatus("saved");
      } else {
        // Backoff: si viene fallando, espaciar en vez de martillar el enlace.
        espera = hubeFallo ? Math.min(espera * 2, RESYNC_MAX) : RESYNC_INTERVAL;
        setStatus(isOffline() ? "offline" : "error");
      }
    };

    drenarRef.current = () => void drenar();

    // Un solo temporizador que se re-agenda solo (en vez de setInterval): así el
    // backoff aplica de verdad y dos pases no pueden solaparse.
    const ciclo = async () => {
      await drenar();
      if (!vivo) return;
      timer = window.setTimeout(() => void ciclo(), espera);
    };
    void ciclo();

    const onOnline = () => {
      espera = RESYNC_INTERVAL; // volvió la señal: reintentar ya, sin castigo
      void drenar();
    };
    window.addEventListener("online", onOnline);
    // El recorrido por pisos encola por su cuenta (no pasa por el formulario), y
    // sin este aviso su subida esperaba hasta 15 s y el indicador mentía diciendo
    // que no había nada pendiente.
    const onEncolado = () => void drenar();
    window.addEventListener("semco:outbox", onEncolado);

    return () => {
      vivo = false;
      drenarRef.current = () => {};
      window.removeEventListener("online", onOnline);
      window.removeEventListener("semco:outbox", onEncolado);
      if (timer) window.clearTimeout(timer);
    };
  }, [visitId]);

  useEffect(() => {
    if (!enabled) return;
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const timersMap = timers.current; // estable; capturado para el cleanup
    let disposed = false;
    const refreshPending = () => {
      if (!disposed) setPendingN(pendingCount(visitId));
    };

    const extract = (
      el: HTMLInputElement | HTMLTextAreaElement
    ): FieldPayload | null => {
      const name = el.name;
      if (!name) return null;
      if (name === "notes") return { kind: "notes", notes: el.value };
      if (!name.startsWith("item-")) return null;
      const itemId = name.slice("item-".length);
      const type = (el as HTMLInputElement).type;

      if (type === "radio") {
        if (!(el as HTMLInputElement).checked) return null;
        const v = (el as HTMLInputElement).value;
        if (v === "approved") return { kind: "response", itemId, valueBool: true };
        if (v === "failed") return { kind: "response", itemId, valueBool: false };
        // "na" u otro → value_text 'na', bool null (igual que el handler bulk)
        return { kind: "response", itemId, valueText: "na" };
      }
      if (type === "checkbox") {
        return { kind: "response", itemId, valueBool: (el as HTMLInputElement).checked };
      }
      if (type === "number") {
        const raw = el.value.trim();
        const n = raw === "" ? null : Number(raw);
        return {
          kind: "response",
          itemId,
          valueNumber: n === null || Number.isNaN(n) ? null : n,
        };
      }
      // text / textarea
      return { kind: "response", itemId, valueText: el.value };
    };

    // Repinta un valor en el formulario. Sirve para que, tras recargar en un
    // sótano, el técnico VEA lo que ya respondió — venga de la cola (todavía sin
    // subir) o de la copia local de lo que YA subió.
    const applyPayload = (p: OutboxPayload) => {
      if (p.kind === "notes") {
        const el = form.elements.namedItem("notes") as HTMLTextAreaElement | null;
        if (el) el.value = p.notes;
        return;
      }
      const node = form.elements.namedItem(`item-${p.itemId}`);
      if (!node) return;
      if (node instanceof RadioNodeList) {
        let target: string | null = null;
        if (p.valueBool === true) target = "approved";
        else if (p.valueBool === false) target = "failed";
        else if (p.valueText === "na") target = "na";
        Array.from(node).forEach((n) => {
          const inp = n as HTMLInputElement;
          inp.checked = target !== null && inp.value === target;
        });
        return;
      }
      const el = node as HTMLInputElement | HTMLTextAreaElement;
      const type = (el as HTMLInputElement).type;
      if (type === "checkbox") {
        (el as HTMLInputElement).checked = p.valueBool === true;
      } else if (type === "number") {
        el.value =
          p.valueNumber === null || p.valueNumber === undefined
            ? ""
            : String(p.valueNumber);
      } else {
        el.value = p.valueText ?? "";
      }
    };

    // Guarda durable (síncrono) y le avisa al drenador único. La subida y el
    // estado los maneja ÉL: acá no se dispara ningún envío propio, que era la
    // otra mitad de la avalancha del 4-ago.
    const capture = (payload: FieldPayload) => {
      enqueue(visitId, payload); // DURABLE primero — nunca se pierde
      // Copia que SOBREVIVE a la subida: el outbox se vacía al subir y el HTML
      // cacheado puede ser viejo, así que sin esto el formulario se repinta en
      // blanco al recargar sin señal (ver lastValues.ts).
      saveLastValue(visitId, payload);
      refreshPending();
      drenarRef.current();
    };

    const schedule = (
      el: HTMLInputElement | HTMLTextAreaElement,
      delay: number
    ) => {
      const payload = extract(el);
      if (!payload) return;
      const key = el.name;
      const existing = timers.current.get(key);
      if (existing) window.clearTimeout(existing);
      const t = window.setTimeout(() => {
        timers.current.delete(key);
        capture(payload);
      }, delay);
      timers.current.set(key, t);
    };

    // Captura inmediata y durable (cancela el debounce pendiente del campo).
    const captureNow = (el: HTMLInputElement | HTMLTextAreaElement) => {
      const key = el.name;
      const existing = timers.current.get(key);
      if (existing) {
        window.clearTimeout(existing);
        timers.current.delete(key);
      }
      const payload = extract(el);
      if (payload) capture(payload);
    };

    const onInput = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (!el?.name) return;
      if (el.type === "radio" || el.type === "checkbox") return; // van por 'change'
      schedule(el, DEBOUNCE_TEXT);
    };
    const onChange = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (!el?.name) return;
      schedule(el, DEBOUNCE_CHOICE);
    };
    const onBlur = (e: FocusEvent) => {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!el?.name) return;
      captureNow(el);
    };

    // Vuelca a durable TODO lo que esté en debounce. Se llama cuando el técnico se
    // va a otra cosa o el sistema puede matar la app (justo el caso del sótano).
    const flushPendingTimers = () => {
      const names = Array.from(timers.current.keys());
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
      for (const name of names) {
        const el = form.elements.namedItem(name) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | RadioNodeList
          | null;
        if (!el) continue;
        if (el instanceof RadioNodeList) {
          const checked = Array.from(el).find(
            (n) => (n as HTMLInputElement).checked
          ) as HTMLInputElement | undefined;
          if (checked) captureNow(checked);
        } else {
          captureNow(el);
        }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushPendingTimers();
    };
    const onPageHide = () => flushPendingTimers();

    // Al montar: repintar el formulario con lo que este equipo respondió. Primero
    // lo ya subido (copia local) y encima lo que sigue en la cola, que es más
    // nuevo. Sin la primera capa, recargar sin señal deja la pantalla en blanco
    // aunque el dato esté a salvo en la base. El drenado lo arranca el otro efecto.
    for (const payload of readLastValues(visitId)) applyPayload(payload);
    for (const entry of pending(visitId)) applyPayload(entry.payload);
    refreshPending();

    form.addEventListener("input", onInput, true);
    form.addEventListener("change", onChange, true);
    form.addEventListener("blur", onBlur, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      disposed = true;
      form.removeEventListener("input", onInput, true);
      form.removeEventListener("change", onChange, true);
      form.removeEventListener("blur", onBlur, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      timersMap.forEach((t) => window.clearTimeout(t));
      timersMap.clear();
    };
  }, [visitId, formId, enabled]);

  if (!enabled) return null;

  const label =
    status === "saving"
      ? // Con el número a la vista se ve que AVANZA. Sin él, un "Guardando…" pelado
        // durante una cola larga se lee como colgado — la queja textual de William.
        `Guardando…${pendingN > 0 ? ` (${pendingN} por subir)` : ""}`
      : status === "offline"
      ? `Sin señal — guardado en el equipo${
          pendingN > 0 ? ` (${pendingN} por subir)` : ""
        }`
      : status === "error"
      ? `Reintentando…${pendingN > 0 ? ` (${pendingN} por subir)` : ""}`
      : status === "saved"
      ? `Guardado ✓${
          savedAt
            ? " " +
              savedAt.toLocaleTimeString("es-PA", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""
        }`
      : "Autoguardado activo";

  const tone =
    status === "offline"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : status === "error"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : status === "saving"
      ? "border-amber-300 bg-amber-50 text-amber-700"
      : "border-emerald-300 bg-emerald-50 text-emerald-700";

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm ${tone}`}
    >
      {label}
    </div>
  );
}
