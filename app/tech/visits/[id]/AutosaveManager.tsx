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
export default function AutosaveManager({ visitId, formId, enabled }: Props) {
  const [status, setStatus] = useState<
    "idle" | "saving" | "saved" | "offline" | "error"
  >("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pendingN, setPendingN] = useState(0);
  const timers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const timersMap = timers.current; // estable; capturado para el cleanup
    let disposed = false;
    const isOffline = () =>
      typeof navigator !== "undefined" && navigator.onLine === false;
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

    // Aplica un valor pendiente (no sincronizado) de vuelta al formulario. Sirve
    // para que, tras recargar en un sótano, el técnico VEA lo que ya respondió.
    const applyEntry = (entry: OutboxEntry) => {
      const p = entry.payload;
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

    // Intenta subir UNA entrada. true = el server la aceptó (y se saca de la cola).
    const trySend = async (entry: OutboxEntry): Promise<boolean> => {
      try {
        const res = await autosaveResponse({ visitId, ...entry.payload });
        if (res.ok) {
          resolve(entry.key);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    // Guarda durable (síncrono) y dispara el intento de subida.
    const capture = (payload: FieldPayload) => {
      const entry = enqueue(visitId, payload); // DURABLE primero — nunca se pierde
      refreshPending();
      void drainOne(entry);
    };

    const drainOne = async (entry: OutboxEntry) => {
      if (isOffline()) {
        if (!disposed) setStatus("offline");
        return;
      }
      if (!disposed) setStatus("saving");
      const ok = await trySend(entry);
      if (disposed) return;
      refreshPending();
      if (ok) {
        setSavedAt(new Date());
        setStatus(pendingCount(visitId) > 0 ? "offline" : "saved");
      } else {
        setStatus(isOffline() ? "offline" : "error");
      }
    };

    // Reintenta TODA la cola de esta visita (al volver la señal, al montar, y periódico).
    const drainAll = async () => {
      const items = pending(visitId);
      if (items.length === 0) return;
      if (isOffline()) {
        if (!disposed) setStatus("offline");
        return;
      }
      if (!disposed) setStatus("saving");
      for (const entry of items) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await trySend(entry);
        if (disposed) return;
        if (!ok && isOffline()) break; // se cayó la señal a mitad: dejar el resto en cola
      }
      refreshPending();
      if (!disposed) {
        const left = pendingCount(visitId);
        if (left === 0) {
          setSavedAt(new Date());
          setStatus("saved");
        } else {
          setStatus(isOffline() ? "offline" : "error");
        }
      }
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
    const onOnline = () => {
      void drainAll();
    };

    // Al montar: rehidratar con lo pendiente (sobrevivió a la recarga) y drenar cola.
    const items = pending(visitId);
    for (const entry of items) applyEntry(entry);
    refreshPending();
    if (items.length > 0) setStatus(isOffline() ? "offline" : "saving");
    void drainAll();

    form.addEventListener("input", onInput, true);
    form.addEventListener("change", onChange, true);
    form.addEventListener("blur", onBlur, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    const interval = window.setInterval(() => {
      if (!isOffline()) void drainAll();
    }, RESYNC_INTERVAL);

    return () => {
      disposed = true;
      form.removeEventListener("input", onInput, true);
      form.removeEventListener("change", onChange, true);
      form.removeEventListener("blur", onBlur, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
      timersMap.forEach((t) => window.clearTimeout(t));
      timersMap.clear();
    };
  }, [visitId, formId, enabled]);

  if (!enabled) return null;

  const label =
    status === "saving"
      ? "Guardando…"
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
