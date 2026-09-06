/**
 * Casillas del checklist que NO se leen bien como "Aprobado / Falla".
 *
 * Las tres pantallas que muestran una casilla — la del técnico, el informe en pantalla del
 * gerente y el PDF que va al cliente — tienen que decir lo mismo. Antes cada una traía su
 * propia copia de estos chequeos y se desincronizaron: el 5-sep-2026 el técnico ya marcaba
 * "Bajo nivel" mientras el informe seguía imprimiendo "No". Por eso viven aquí, en un solo
 * lugar.
 *
 * 🔑 Esto SOLO cambia la etiqueta visible. Se sigue guardando approved/failed/na →
 * value_bool true/false/null, así que los informes viejos se leen igual y no hay que migrar.
 */

/**
 * Niveles: aceite, refrigerante, combustible, electrolitos.
 * Pedido de William por correo el 5-sep-2026: *"muchas veces no tienen indicadores del nivel,
 * así que mejor procedamos con afirmaciones Bajo nivel / buen nivel de refrigerante,
 * combustible"*. Un visor sin marcas no se puede declarar "aprobado" con honestidad; sí se
 * puede decir si está bien o bajo.
 */
export const isNivelLabel = (label?: string | null) => {
  const l = (label ?? "").trim().toLowerCase();
  return (
    /el nivel de (aceite|agua de refrigeraci|electrolitos)/.test(l) ||
    /el tanque de combustible/.test(l) ||
    /nivel de (aceite|refrigerante|combustible) ok$/.test(l) ||
    /- combustible ok$/.test(l)
  );
};

/** El foso se limpia, no se "aprueba": Aprobado / Requiere limpieza. */
export const isEstadoFosoLabel = (label?: string | null) =>
  (label ?? "").trim().toLowerCase().endsWith("estado del foso");

/** El panel tiene tres estados reales: Bueno / Regular / Malo (approved / na / failed). */
export const isEstadoGeneralPanelLabel = (label?: string | null) =>
  (label ?? "").trim().toLowerCase().endsWith("estado general del panel");

/** Texto de una casilla ya respondida, común a informe en pantalla y PDF. */
export const formatChecklistValue = (
  valueBool: boolean | null,
  valueText: string | null | undefined,
  label?: string | null
): string => {
  if (isEstadoGeneralPanelLabel(label)) {
    // "Regular" ES el estado na, así que va antes del chequeo de null.
    if (valueBool === true) return "Bueno";
    if (valueBool === false) return "Malo";
    return valueText === "na" ? "Regular" : "—";
  }
  if (valueBool === null) return valueText === "na" ? "N/A" : "—";
  if (isNivelLabel(label)) return valueBool ? "Buen nivel" : "Bajo nivel";
  if (isEstadoFosoLabel(label)) return valueBool ? "Aprobado" : "Requiere limpieza";
  return valueBool ? "Sí" : "No";
};
