// Fuente ÚNICA de los sistemas de equipo y sus etiquetas visibles.
//
// Antes esta lista vivía copiada en 5 archivos (EquipmentForm, PhotoCaptureField,
// OfflinePhotoCapture, tech/buildings/[id]/equipment y tech/visits/[id]) y ya se había
// desincronizado: el mismo sistema se le mostraba al técnico como "Achique elevador" en
// una pantalla y "Foso elevador" en otra, "Sanitario" vs "Aguas sanitarias",
// "Planta diésel" vs "Planta eléctrica". Agregar un sistema obligaba a tocar los 5.
//
// El código crudo (`transferencia_agua_potable`, …) es el mismo que escribe la precarga
// del levantamiento (scripts/import_building_excel.py) y el que lee el filtro del
// checklist (lib/bombas/checklistFilter.ts). No renombrar claves sin migrar `equipment`.

export const SYSTEM_LABELS: Record<string, string> = {
  transferencia_agua_potable: "Transferencia agua potable",
  reforzador_agua_potable: "Reforzador agua potable",
  contra_incendios: "Contra incendios (NFPA)",
  contra_incendios_no_normada: "Contra incendios (no normada)",
  achique_freatico: "Achique freático",
  achique_elevador: "Achique elevador",
  achique_pluvial: "Achique pluvial",
  sanitario: "Sanitario",
  planta_diesel: "Planta diésel",
  // Ventiladores de presurización de escaleras. La plantilla de presurización trae
  // "Ventilador 1..4" fijos; sin este sistema no había forma de saber cuántos tiene el
  // edificio, y a Metro View (1 ventilador por torre) le salían los 4 — feedback
  // William 27-jul. Ver `fanCount` en lib/bombas/checklistFilter.ts.
  presurizacion_escaleras: "Presurización de escaleras",
};

// Orden de los dropdowns donde se registra o clasifica un equipo.
export const SYSTEMS: [string, string][] = [
  "transferencia_agua_potable",
  "reforzador_agua_potable",
  "contra_incendios",
  "contra_incendios_no_normada",
  "achique_freatico",
  "achique_elevador",
  "achique_pluvial",
  "sanitario",
  "planta_diesel",
  "presurizacion_escaleras",
].map((key) => [key, SYSTEM_LABELS[key]] as [string, string]);

// Igual que SYSTEMS pero con la opción vacía adelante, para los selectores donde el
// sistema es opcional (etiquetar una foto que no pertenece a ningún sistema).
export const SYSTEM_OPTIONS_WITH_BLANK: [string, string][] = [
  ["", "General (sin sistema)"],
  ...SYSTEMS,
];

// Tipos de equipo. `ventilador` acompaña a `presurizacion_escaleras`: no es una bomba
// ni un panel, y el filtro lo cuenta aparte.
export const KINDS: [string, string][] = [
  ["bomba", "Bomba"],
  ["panel_control", "Panel de control"],
  ["generador", "Generador"],
  ["ventilador", "Ventilador"],
];

export const systemLabel = (system: string | null | undefined): string =>
  (system && SYSTEM_LABELS[system]) || system || "Sin sistema";

/**
 * Opciones del selector de sistema al capturar evidencia.
 *
 * Desde el 6-ago-2026 elegir sistema es obligatorio (antes la opción por defecto era
 * "General (sin sistema)" y el 82% de las fotos llegaba sin sistema, así que el informe
 * mostraba un manómetro y nadie sabía de cuál sistema era). Al ser obligatorio, esta
 * lista NO puede quedar vacía nunca: un selector vacío deja al técnico sin poder tomar
 * fotos en un sótano, que es peor que el problema original. De ahí el fallback.
 *
 * - Con inventario del edificio → solo esos sistemas, en el orden del catálogo.
 * - Un sistema del edificio fuera del catálogo → igual se ofrece, al final.
 * - Sin inventario → catálogo completo.
 */
export const photoSystemOptions = (
  buildingSystems: readonly string[] | null | undefined
): [string, string][] => {
  const presentes = new Set(
    (buildingSystems ?? []).map((s) => (s ?? "").trim()).filter(Boolean)
  );
  if (presentes.size === 0) return SYSTEMS;

  const delCatalogo = SYSTEMS.filter(([key]) => presentes.has(key));
  const conocidos = new Set(delCatalogo.map(([key]) => key));
  const extras = [...presentes]
    .filter((key) => !conocidos.has(key))
    .map((key) => [key, SYSTEM_LABELS[key] ?? key] as [string, string]);

  const opciones = [...delCatalogo, ...extras];
  return opciones.length > 0 ? opciones : SYSTEMS;
};
