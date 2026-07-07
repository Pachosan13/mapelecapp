"use client";

/**
 * Outbox durable para el autosave del técnico.
 *
 * PROBLEMA QUE RESUELVE: en sótanos/fosos (sin señal) las respuestas de la visita
 * se perdían. El autosave es un server action (red); al fallar offline no quedaba
 * NADA local y, si el técnico recargaba o el sistema mataba la app, la data se
 * borraba. Ahora cada cambio se escribe PRIMERO acá — en `localStorage`, que
 * sobrevive recarga de página y cierre de la app — y se re-sincroniza solo cuando
 * vuelve la conexión.
 *
 * Diseño:
 * - Cola con dedupe por campo (`visitId::kind::item`): la última edición de un
 *   campo reemplaza a la anterior. Así la cola no crece sin límite y respeta el
 *   modelo append-only del server (última respuesta gana vía `visit_latest_responses`).
 * - Solo texto/número/booleano (respuestas de checklist + notas). Liviano: cabe de
 *   sobra en el presupuesto de ~5 MB de localStorage. Las fotos NO pasan por acá.
 * - Todo `try/catch`: modo privado / storage lleno nunca debe romper la UI del campo.
 */

export type OutboxPayload =
  | { kind: "notes"; notes: string }
  | {
      kind: "response";
      itemId: string;
      valueText?: string | null;
      valueNumber?: number | null;
      valueBool?: boolean | null;
    };

export type OutboxEntry = {
  /** clave de dedupe: `${visitId}::${kind}::${item-id|notes}` */
  key: string;
  visitId: string;
  payload: OutboxPayload;
  /** momento de captura (orden FIFO + diagnóstico) */
  ts: number;
};

const STORE_KEY = "semco.outbox.v1";

function safeRead(): Record<string, OutboxEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, OutboxEntry>) : {};
  } catch {
    return {};
  }
}

function safeWrite(all: Record<string, OutboxEntry>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    // localStorage lleno o modo privado: no hay más que hacer, pero NO romper la UI.
  }
}

function fieldKey(visitId: string, payload: OutboxPayload): string {
  const leaf = payload.kind === "notes" ? "notes" : `item-${payload.itemId}`;
  return `${visitId}::${payload.kind}::${leaf}`;
}

/**
 * Guarda (o reemplaza) el último valor de un campo. Escritura SÍNCRONA y durable:
 * al volver de esta función el dato ya sobrevive a un cierre de la app.
 */
export function enqueue(visitId: string, payload: OutboxPayload): OutboxEntry {
  const all = safeRead();
  const key = fieldKey(visitId, payload);
  const entry: OutboxEntry = { key, visitId, payload, ts: Date.now() };
  all[key] = entry;
  safeWrite(all);
  return entry;
}

/** Quita una entrada de la cola tras confirmar que el server la guardó. */
export function resolve(key: string): void {
  const all = safeRead();
  if (all[key]) {
    delete all[key];
    safeWrite(all);
  }
}

/** Entradas pendientes de sincronizar (de una visita, o de todas), en orden FIFO. */
export function pending(visitId?: string): OutboxEntry[] {
  const all = safeRead();
  const list = Object.values(all).sort((a, b) => a.ts - b.ts);
  return visitId ? list.filter((e) => e.visitId === visitId) : list;
}

/** Cuántas respuestas quedan sin subir (para el indicador de estado). */
export function pendingCount(visitId?: string): number {
  return pending(visitId).length;
}
