// Filtro dinámico del checklist de bombas por edificio (feedback William 1-jul / ONIX 5-jul).
// El formato de bombas debe reflejar el inventario REAL del edificio, no una plantilla fija.
// Se apoya en la precarga de equipos (tabla `equipment`, columnas `system` y `kind`):
//   - Bombas principales y reforzadoras → una unidad "Bomba N" por cada bomba (kind='bomba')
//     del sistema; se ocultan las unidades sobrantes de la plantilla.
//   - Bombas sumergibles → solo los SUBTIPOS (Foso elevador / Sistema pluvial / Sistema
//     sanitario / freático) cuyo sistema esté precargado.
//   - Grupos gatillados por presencia de sistema (Jockey, contra incendio, planta).
//   - Grupos generales/administrativos (Datos generales, Tablero, Entrega) → SIEMPRE.
//
// ⚠️ Fuente ÚNICA de la lógica: la usan el render + el guardado (app/tech/visits/[id]/page.tsx)
// Y el PDF (lib/reports/serviceReport.ts). No duplicar; editar solo aquí.

// Grupos que solo se muestran si el edificio tiene AL MENOS un equipo de esos sistemas
// (sin conteo por unidad). Los grupos por-unidad se resuelven aparte en itemAppliesToBuilding.
const GROUP_TO_SYSTEMS: Record<string, string[]> = {
  "Bomba Jockey": ["contra_incendios"],
  "Bomba contra incendio": ["contra_incendios"],
  "Planta electrica": ["planta_diesel"],
};

// Subtipo de sumergible (2º segmento del label) → sistema que lo activa. Ej.:
// "Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 1 - ..." → achique_pluvial.
const SUBMERSIBLE_SUBTYPE_TO_SYSTEM: Record<string, string> = {
  "Foso elevador": "achique_elevador",
  "Sistema pluvial": "achique_pluvial",
  "Sistema freático": "achique_freatico",
  "Sistema freatico": "achique_freatico",
  "Sistema sanitario": "sanitario",
};

// Nombre del grupo = prefijo del label antes del primer " - " (los ítems se llaman
// "Bombas principales - Bomba 1 - Voltaje L1-L2"). Sin " - " → "Datos generales".
export const groupOf = (label: string) => {
  const i = label.indexOf(" - ");
  return i > 0 ? label.slice(0, i).trim() : "Datos generales";
};

// 2º segmento del label (subtipo de sumergible). "" si no existe.
const subtypeOf = (label: string) => {
  const parts = label.split(" - ");
  return parts.length >= 2 ? parts[1].trim() : "";
};

// Nº de unidad de una bomba principal: "Bombas principales - Bomba N - ...". null si no lo trae.
const principalUnitOf = (label: string) => {
  const m = label.match(/^Bombas principales - Bomba (\d+) -/);
  return m ? Number(m[1]) : null;
};

// Nº de unidad de una reforzadora: grupo "Bomba reforzadora N". null si no aplica.
const reforzadoraUnitOf = (groupName: string) => {
  const m = groupName.match(/^Bomba reforzadora (\d+)$/);
  return m ? Number(m[1]) : null;
};

// Alcance del edificio derivado de la precarga: sistemas presentes + nº de BOMBAS
// (kind='bomba', excluye paneles/generadores) por sistema.
export type BuildingScope = {
  systems: Set<string>;
  pumpCounts: Map<string, number>;
};

export const buildBuildingScope = (
  rows: Array<{ system: string | null; kind?: string | null }>
): BuildingScope => {
  const systems = new Set<string>();
  const pumpCounts = new Map<string, number>();
  for (const r of rows) {
    if (!r.system) continue;
    systems.add(r.system);
    if (r.kind === "bomba") {
      pumpCounts.set(r.system, (pumpCounts.get(r.system) ?? 0) + 1);
    }
  }
  return { systems, pumpCounts };
};

// ¿Este ítem aplica al edificio? Combina conteo por unidad (principales/reforzadoras),
// filtro por subtipo (sumergibles) y presencia de sistema (resto). Debe usarse igual en el
// render, el guardado y el PDF para que no se desincronicen.
export const itemAppliesToBuilding = (label: string, scope: BuildingScope) => {
  const group = groupOf(label);

  // Principales: una "Bomba N" por cada bomba de transferencia. Sin bombas → grupo oculto.
  if (group === "Bombas principales") {
    const count = scope.pumpCounts.get("transferencia_agua_potable") ?? 0;
    if (count === 0) return false;
    const unit = principalUnitOf(label);
    return unit === null ? true : unit <= count;
  }

  // Reforzadoras: un grupo por unidad; se muestran solo hasta el nº de bombas reforzadoras.
  const refUnit = reforzadoraUnitOf(group);
  if (refUnit !== null) {
    const count = scope.pumpCounts.get("reforzador_agua_potable") ?? 0;
    return refUnit <= count;
  }

  // Sumergibles: solo los subtipos cuyo sistema esté presente. Subtipo desconocido → mostrar.
  if (group === "Bombas sumergibles") {
    const sys = SUBMERSIBLE_SUBTYPE_TO_SYSTEM[subtypeOf(label)];
    if (!sys) return true;
    return scope.systems.has(sys);
  }

  // Resto: general/administrativo → siempre; gatillado por sistema → presencia del sistema.
  const systems = GROUP_TO_SYSTEMS[group];
  if (!systems) return true;
  return systems.some((s) => scope.systems.has(s));
};
