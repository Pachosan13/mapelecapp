"use client";

import { useEffect, useRef, useState } from "react";
import { autosaveResponse } from "./autosave";

type Props = {
  visitId: string;
  /** id del <form> de respuestas al que engancharse. */
  formId: string;
  /** solo activo mientras la visita está en progreso (no completada). */
  enabled: boolean;
};

type FieldPayload =
  | { kind: "notes"; notes: string }
  | {
      kind: "response";
      itemId: string;
      valueText?: string | null;
      valueNumber?: number | null;
      valueBool?: boolean | null;
    };

const DEBOUNCE_TEXT = 1200; // texto/número: espera a que deje de escribir
const DEBOUNCE_CHOICE = 250; // radio/checkbox: casi inmediato

/**
 * Autosave silencioso del formulario del técnico.
 *
 * Se engancha al <form> por delegación de eventos (input/change/blur), así no
 * hay que reescribir cada campo. Cada cambio se persiste solo (debounced), y se
 * hace flush inmediato en blur del campo y cuando la pestaña se oculta
 * (visibilitychange) — que es justo el caso "el técnico se va a hacer otra cosa".
 */
export default function AutosaveManager({ visitId, formId, enabled }: Props) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const extract = (el: HTMLInputElement | HTMLTextAreaElement): FieldPayload | null => {
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

    let disposed = false;
    const flush = async (payload: FieldPayload) => {
      setStatus("saving");
      try {
        const res = await autosaveResponse({ visitId, ...payload });
        if (disposed) return;
        if (res.ok) {
          setSavedAt(res.at ? new Date(res.at) : new Date());
          setStatus("saved");
        } else {
          setStatus("error");
        }
      } catch {
        if (!disposed) setStatus("error");
      }
    };

    const schedule = (el: HTMLInputElement | HTMLTextAreaElement, delay: number) => {
      const payload = extract(el);
      if (!payload) return;
      const key = el.name;
      const existing = timers.current.get(key);
      if (existing) window.clearTimeout(existing);
      const t = window.setTimeout(() => {
        timers.current.delete(key);
        void flush(payload);
      }, delay);
      timers.current.set(key, t);
    };

    const flushNow = (el: HTMLInputElement | HTMLTextAreaElement) => {
      const key = el.name;
      const existing = timers.current.get(key);
      if (existing) {
        window.clearTimeout(existing);
        timers.current.delete(key);
      }
      const payload = extract(el);
      if (payload) void flush(payload);
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
      flushNow(el);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      // El técnico se va a otra cosa: flush inmediato de todo lo pendiente.
      const pending = Array.from(timers.current.keys());
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
      for (const name of pending) {
        const el = form.elements.namedItem(name) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | RadioNodeList
          | null;
        if (!el) continue;
        // RadioNodeList (grupo de radios): tomar el chequeado
        if (el instanceof RadioNodeList) {
          const checked = Array.from(el).find(
            (n) => (n as HTMLInputElement).checked
          ) as HTMLInputElement | undefined;
          if (checked) flushNow(checked);
        } else {
          flushNow(el);
        }
      }
    };

    form.addEventListener("input", onInput, true);
    form.addEventListener("change", onChange, true);
    form.addEventListener("blur", onBlur, true);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      form.removeEventListener("input", onInput, true);
      form.removeEventListener("change", onChange, true);
      form.removeEventListener("blur", onBlur, true);
      document.removeEventListener("visibilitychange", onVisibility);
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
    };
  }, [visitId, formId, enabled]);

  if (!enabled) return null;

  const label =
    status === "saving"
      ? "Guardando…"
      : status === "error"
      ? "Error al guardar (dale «Guardar»)"
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
    status === "error"
      ? "border-red-300 bg-red-50 text-red-700"
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
