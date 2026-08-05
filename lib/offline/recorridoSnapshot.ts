"use client";

/**
 * Última copia LOCAL buena del recorrido (la tabla de pisos de red húmeda).
 *
 * PROBLEMA QUE RESUELVE (4-ago-2026, PH MATISSE): el recorrido viaja como UN
 * solo JSON en una sola respuesta — es todo o nada. La tabla se hidrata una vez
 * al montar desde el outbox y, si ahí no hay nada pendiente, desde el valor que
 * mandó el server. Pero el service worker sirve el HTML cacheado al recargar sin
 * señal, así que ese valor puede ser viejo. Entonces: el técnico llena 56 pisos →
 * suben → la entrada sale del outbox → recarga en la escalera → la tabla se pinta
 * con el HTML viejo (pisos en blanco) → toca UNA celda → se re-serializan las 70
 * filas vacías y pisan los 56 pisos buenos. Textual de William:
 * *"lo había borrado y lo tuve que volver a llenar"*.
 *
 * El outbox no alcanza porque borra la entrada apenas sube. Esta copia sobrevive
 * a la sincronización: es lo último que ESTE equipo escribió, y al montar se
 * fusiona con lo que venga del server para que ninguna fila con datos se pierda.
 *
 * Liviano: ~16 KB por recorrido, se guardan los 10 más recientes.
 */

const STORE_KEY = "semco.recorrido.v1";
const MAX_ENTRIES = 10;

type Snapshot = { value: string; ts: number };

function safeRead(): Record<string, Snapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Snapshot>) : {};
  } catch {
    return {};
  }
}

function key(visitId: string, itemId: string): string {
  return `${visitId}::${itemId}`;
}

/** Guarda la última versión que este equipo escribió de un recorrido. */
export function saveSnapshot(
  visitId: string,
  itemId: string,
  value: string
): void {
  if (typeof window === "undefined") return;
  try {
    const all = safeRead();
    all[key(visitId, itemId)] = { value, ts: Date.now() };
    const podados = Object.entries(all)
      .sort((a, b) => b[1].ts - a[1].ts)
      .slice(0, MAX_ENTRIES);
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify(Object.fromEntries(podados))
    );
  } catch {
    // storage lleno o modo privado: nunca romper la captura en campo.
  }
}

/** Última versión local, o null si este equipo nunca escribió ese recorrido. */
export function readSnapshot(visitId: string, itemId: string): string | null {
  return safeRead()[key(visitId, itemId)]?.value ?? null;
}
