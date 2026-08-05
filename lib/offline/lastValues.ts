"use client";

import type { OutboxPayload } from "./outbox";

/**
 * Último valor que ESTE equipo escribió en cada campo de una visita.
 *
 * PROBLEMA QUE RESUELVE (5-ago-2026, encontrado mirando la pantalla): el outbox
 * borra la entrada apenas sube, y el service worker sirve el HTML cacheado al
 * recargar sin señal. Entre esas dos cosas queda un hueco: lo que el técnico ya
 * respondió Y ya subió no está en el outbox ni en el HTML viejo. Al recargar en
 * un sótano el formulario aparece EN BLANCO aunque el dato esté a salvo en la
 * base. Medido: 40 ítems marcados → 1 en pantalla tras recargar. Para el técnico
 * es idéntico a que se le hubiera borrado, y es literal lo que reportó William:
 * *"lo había borrado y lo tuve que volver a llenar"*.
 *
 * Esto guarda una copia que SOBREVIVE a la subida, para repintar el formulario.
 * Es espejo de lo que hace `recorridoSnapshot` con la tabla de pisos.
 *
 * Liviano: son textos/números/booleanos. Se poda a las 800 entradas más nuevas
 * (≈15 visitas del formulario más grande) para no crecer sin fin.
 */

const STORE_KEY = "semco.lastvalues.v1";
const MAX_ENTRIES = 800;

type Registro = { visitId: string; payload: OutboxPayload; ts: number };

function safeRead(): Record<string, Registro> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Registro>) : {};
  } catch {
    return {};
  }
}

function fieldKey(visitId: string, payload: OutboxPayload): string {
  const leaf = payload.kind === "notes" ? "notes" : `item-${payload.itemId}`;
  return `${visitId}::${payload.kind}::${leaf}`;
}

/** Guarda el último valor de un campo (además de encolarlo para subir). */
export function saveLastValue(visitId: string, payload: OutboxPayload): void {
  if (typeof window === "undefined") return;
  try {
    const all = safeRead();
    all[fieldKey(visitId, payload)] = { visitId, payload, ts: Date.now() };
    const podado = Object.entries(all)
      .sort((a, b) => b[1].ts - a[1].ts)
      .slice(0, MAX_ENTRIES);
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify(Object.fromEntries(podado))
    );
  } catch {
    // storage lleno o modo privado: nunca romper la captura en campo.
  }
}

/** Lo que este equipo respondió en esa visita, del más viejo al más nuevo. */
export function readLastValues(visitId: string): OutboxPayload[] {
  return Object.values(safeRead())
    .filter((r) => r.visitId === visitId)
    .sort((a, b) => a.ts - b.ts)
    .map((r) => r.payload);
}
