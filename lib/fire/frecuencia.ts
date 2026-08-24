// Filtro del checklist NFPA-25 por FRECUENCIA de inspección.
//
// Feedback William Rodríguez (SEMCO, 24-ago-2026): "me comentan los muchachos que en el
// formato de rociadores tienen que colocar 'no aplica' muchas veces. Generalmente solo
// usamos el mensual."
//
// El formato de rociadores trae 76 ítems repartidos en bloques por frecuencia (Mensual,
// Trimestral, Semestral, Anual, Cada 5 años). En una inspección MENSUAL solo aplican 12;
// los otros 64 el técnico los tenía que marcar N/A uno por uno, y el informe del cliente
// salía con 64 filas de "—". Este módulo recorta el formulario (y el informe) a la
// frecuencia que el técnico declara en "Tipo de inspección".
//
// NFPA 25 es ACUMULATIVO: una inspección trimestral incluye lo mensual, la anual incluye
// todo lo de abajo. Por eso el filtro es "índice del ítem <= índice de la seleccionada".
//
// ⚠️ Fuente ÚNICA de la lógica: la usan el render + el guardado del técnico
// (app/tech/visits/[id]/page.tsx), el informe por visita (app/ops/visits/[id]/report) y
// el PDF/informe de servicio (lib/reports/serviceReport.ts). No duplicar; editar solo acá.

import { groupOf } from "../bombas/checklistFilter.ts";

// Orden = periodicidad creciente. El índice ES la jerarquía del filtro acumulativo.
export const FRECUENCIAS = [
  "Mensual",
  "Trimestral",
  "Semestral",
  "Anual",
  "Cada 5 años",
] as const;

export type Frecuencia = (typeof FRECUENCIAS)[number];

// Sin acentos, sin mayúsculas, sin espacios de sobra. El template real de prod escribe
// "Cada 5 años" pero una respuesta vieja puede venir "cada 5 anos" desde un teclado sin
// acentos: las dos tienen que casar.
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const FRECUENCIA_POR_NORM: Record<string, Frecuencia> = Object.fromEntries(
  FRECUENCIAS.map((f) => [norm(f), f])
) as Record<string, Frecuencia>;

export const indiceFrecuencia = (f: Frecuencia): number => FRECUENCIAS.indexOf(f);

/**
 * Lee una frecuencia de un texto libre. Devuelve null si no reconoce nada — y null
 * significa NO FILTRAR, que es el comportamiento de antes. Las visitas viejas traen
 * "Nfpa25" en ese campo: caen a null y siguen viéndose completas.
 */
export const parseFrecuencia = (texto?: string | null): Frecuencia | null => {
  const clave = norm(String(texto ?? ""));
  if (!clave) return null;
  return FRECUENCIA_POR_NORM[clave] ?? null;
};

/**
 * Frecuencia a la que pertenece un grupo del checklist.
 *
 * El grupo es el prefijo del label antes del primer " - " ("Mensual - Válvulas de
 * control: accesibles" → "Mensual"). Si el bloque alguna vez se anida dentro de un
 * formulario unificado con el separador " · " que usa RED HÚMEDA
 * ("Rociadores · Trimestral - ..."), se toma el último segmento, así el filtro sigue
 * funcionando sin tocar este archivo.
 */
export const frecuenciaDeGrupo = (grupo: string): Frecuencia | null => {
  const partes = grupo.split("·");
  const ultimo = partes[partes.length - 1] ?? "";
  return FRECUENCIA_POR_NORM[norm(ultimo)] ?? null;
};

export const frecuenciaDeItem = (label?: string | null): Frecuencia | null =>
  frecuenciaDeGrupo(groupOf(String(label ?? "")));

/**
 * ¿Este ítem se llena en una inspección de la frecuencia seleccionada?
 *
 * - Sin frecuencia seleccionada → todo aplica (comportamiento previo).
 * - Ítem que no vive en un bloque por frecuencia (Datos generales, Cierre,
 *   Comentarios) → aplica SIEMPRE. Esos no se pueden esconder nunca: ahí van la
 *   firma y el recibido por.
 * - Ítem con frecuencia → aplica si su periodicidad es igual o más corta que la
 *   seleccionada (acumulativo NFPA 25).
 */
export const itemAplicaAFrecuencia = (
  label: string,
  seleccionada: Frecuencia | null
): boolean => {
  if (seleccionada === null) return true;
  const propia = frecuenciaDeItem(label);
  if (propia === null) return true;
  return indiceFrecuencia(propia) <= indiceFrecuencia(seleccionada);
};

/**
 * ¿Este formulario está organizado por frecuencia? Se contesta mirando los labels, no
 * el nombre ni el UUID del template: cualquier formato NFPA que use estos prefijos
 * hereda el selector sin registrarlo en ningún lado. (Registrar UUIDs a mano es
 * justo lo que falló el 20-jul con RED HÚMEDA.)
 *
 * Se exige más de un bloque distinto: un formato que solo tiene "Mensual" no gana nada
 * con un selector.
 */
export const tieneBloquesPorFrecuencia = (
  labels: Array<string | null | undefined>
): boolean => {
  const vistas = new Set<Frecuencia>();
  for (const label of labels) {
    const f = frecuenciaDeItem(label);
    if (f) vistas.add(f);
    if (vistas.size > 1) return true;
  }
  return false;
};

/** Las frecuencias realmente presentes en el formulario, en orden de periodicidad. */
export const frecuenciasPresentes = (
  labels: Array<string | null | undefined>
): Frecuencia[] => {
  const vistas = new Set<Frecuencia>();
  for (const label of labels) {
    const f = frecuenciaDeItem(label);
    if (f) vistas.add(f);
  }
  return FRECUENCIAS.filter((f) => vistas.has(f));
};

/**
 * El ítem donde el técnico declara la frecuencia. En el template de rociadores se llama
 * "Datos generales - Tipo de inspección"; se detecta por el final del label para que
 * sobreviva a un cambio de prefijo de grupo.
 */
export const esItemTipoInspeccion = (label?: string | null): boolean =>
  norm(String(label ?? "")).endsWith("tipo de inspeccion");
