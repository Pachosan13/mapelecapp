"use client";

/**
 * Telemetría de campo — mide lo que hoy hubo que adivinar.
 *
 * POR QUÉ (5-ago-2026): los 6 bugs que se cerraron hoy se diagnosticaron leyendo
 * código y mirando fotos que William mandó por WhatsApp. Cuando un técnico dice
 * "se queda pegado", la app no tiene con qué contestar. Esto guarda contadores y
 * duraciones —nada de PII— para que el próximo reporte se responda con números.
 *
 * TRES REGLAS QUE NO SE ROMPEN, porque el problema que mide es justo el de un
 * enlace saturado y no puede empeorarlo:
 *
 *   1. NUNCA compite con el trabajo real. Solo sube cuando la cola de respuestas
 *      está VACÍA. La evidencia del técnico va primero, siempre.
 *   2. NUNCA rompe la UI. Todo va en try/catch y falla en silencio. Perder una
 *      métrica es gratis; perder una respuesta de campo, no.
 *   3. NUNCA crece sin límite. Tope de eventos en el equipo; al pasarse, se
 *      tiran los más viejos.
 *
 * Interruptor: `TELEMETRIA_ACTIVA = false` la apaga entera.
 */

const STORE_KEY = "semco.telemetry.v1";
const MAX_EVENTOS = 200;
const LOTE = 50;

export const TELEMETRIA_ACTIVA = true;

export type CampoEvento = {
  visitId: string | null;
  event: string;
  payload: Record<string, unknown>;
  clientTs: string;
};

function leer(): CampoEvento[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as CampoEvento[]) : [];
  } catch {
    return [];
  }
}

function escribir(evs: CampoEvento[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(evs.slice(-MAX_EVENTOS)));
  } catch {
    // storage lleno: la telemetría es lo primero que se sacrifica.
  }
}

/** Anota un evento. Barato y síncrono: solo escribe en el equipo. */
export function track(
  visitId: string | null,
  event: string,
  payload: Record<string, unknown> = {}
): void {
  if (!TELEMETRIA_ACTIVA) return;
  try {
    const evs = leer();
    evs.push({ visitId, event, payload, clientTs: new Date().toISOString() });
    escribir(evs);
  } catch {
    /* nunca romper por una métrica */
  }
}

export function pendientes(): number {
  return leer().length;
}

/**
 * Sube lo acumulado. `colaVacia` es obligatorio y decide: si el técnico todavía
 * tiene respuestas por subir, esto no se manda. Regla 1.
 */
export async function flush(colaVacia: boolean): Promise<void> {
  if (!TELEMETRIA_ACTIVA) return;
  if (!colaVacia) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  try {
    const evs = leer();
    if (evs.length === 0) return;
    const lote = evs.slice(0, LOTE);
    const res = await fetch("/api/tech/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: lote }),
    });
    if (!res.ok) return; // se reintenta después; si nunca sube, el tope lo purga
    escribir(evs.slice(lote.length));
  } catch {
    /* sin red o endpoint caído: queda para el próximo intento */
  }
}
