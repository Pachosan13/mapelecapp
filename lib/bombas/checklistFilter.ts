// Filtro dinámico del checklist de bombas por edificio (feedback William 1-jul / ONIX 5-jul).
// El formato de bombas debe reflejar el inventario REAL del edificio, no una plantilla fija.
// Se apoya en la precarga de equipos (tabla `equipment`, columnas `name`, `system`, `kind`):
//   - Bombas principales y reforzadoras → una unidad "Bomba N" por cada bomba (kind='bomba')
//     del sistema; se ocultan las unidades sobrantes de la plantilla.
//   - Bombas sumergibles → solo los SUBTIPOS (Foso elevador / Sistema pluvial / Sistema
//     sanitario / freático) cuyo sistema esté precargado.
//   - Grupos gatillados por la EXISTENCIA del equipo (Tablero, Jockey, contra incendio, planta).
//   - Grupos generales/administrativos (Datos generales, Entrega) → SIEMPRE.
//
// ⚠️ Fuente ÚNICA de la lógica: la usan el render + el guardado (app/tech/visits/[id]/page.tsx)
// Y el PDF (lib/reports/serviceReport.ts). No duplicar; editar solo aquí.

// Fila mínima de `equipment` que el filtro necesita. `name` es obligatorio: sin él no se
// distingue una bomba jockey de una bomba normal, ni se detecta un panel mal tipado.
// Si un consumidor no lo trae en su `select`, TypeScript lo rechaza aquí.
export type EquipmentRow = {
  name: string | null;
  system: string | null;
  kind?: string | null;
};

// Normaliza texto para comparar grupos/subtipos sin que un acento o una mayúscula
// descuadre el filtro. El template real de prod trae AMBAS grafías del mismo grupo
// ("Planta electrica" Y "Planta eléctrica") como grupos distintos — sin esto la variante
// acentuada nunca casa su requisito y la sección se muestra aunque el edificio no tenga
// el equipo (bug reportado por William, Belview Towers 300, 13-jul-2026).
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// ¿Es la plantilla "Mantenimiento – Bombas"? Único lugar donde se decide: lo consultan el
// render del técnico, el PDF y el reporte de ops. Antes vivía duplicado en cada uno.
export const isBombasTemplate = (
  templateName?: string | null,
  templateCategory?: string | null
) => {
  const name = (templateName ?? "").trim().toLowerCase();
  const category = (templateCategory ?? "").trim().toLowerCase();
  return (
    name === "mantenimiento – bombas" || // guion largo
    name === "mantenimiento - bombas" || // guion corto
    category === "bombas"
  );
};

// Sistemas de bomba contra incendios. Una bomba no normada se inspecciona igual que
// una normada (voltajes, presiones); lo que cambia es la clasificación/etiqueta, no
// el mantenimiento base. Los ítems de panel/jockey ya se filtran por su cuenta.
// Fuente ÚNICA — la usan el filtro del checklist y equipmentTypeFor (equipment_type=fire).
export const FIRE_SYSTEMS = new Set<string>([
  "contra_incendios",
  "contra_incendios_no_normada",
]);

export const isFireSystem = (system: string | null | undefined): boolean =>
  system != null && FIRE_SYSTEMS.has(system);

export type EquipmentClass = "panel" | "jockey" | "generador" | "bomba";

/**
 * Clasifica un equipo para decidir qué grupos del checklist activa.
 *
 * `kind` es la fuente de verdad, pero el inventario trae paneles guardados como
 * kind='bomba' (ej. "Panel de Control de Bomba Contra Incendios" en Evergreen Torre A).
 * Contarlos como bombas infla las unidades y activa grupos que el edificio no tiene,
 * así que un nombre que empieza por "Panel" gana sobre un kind dudoso.
 *
 * El orden importa: "Panel de Control de la Bomba Jockey" es un panel, no una jockey.
 */
export const classifyEquipment = (row: EquipmentRow): EquipmentClass => {
  const name = (row.name ?? "").trim();
  if (row.kind === "generador") return "generador";
  if (row.kind === "panel_control" || /^panel\b/i.test(name)) return "panel";
  if (/\bjockey\b/i.test(name)) return "jockey";
  return "bomba";
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

// Versión normalizada (sin acentos/mayúsculas) del mapa de subtipos → sistema.
// Se busca por `norm(subtipo)` para que "Sistema freático" y "Sistema freatico"
// (y cualquier variante de mayúsculas) caigan en la misma entrada.
const SUBMERSIBLE_SUBTYPE_TO_SYSTEM_NORM: Record<string, string> =
  Object.fromEntries(
    Object.entries(SUBMERSIBLE_SUBTYPE_TO_SYSTEM).map(([k, v]) => [norm(k), v])
  );

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
  const m = label.match(/^Bombas principales - Bomba (\d+) -/i);
  return m ? Number(m[1]) : null;
};

// Nº de unidad de una reforzadora: grupo "Bomba reforzadora N". null si no aplica.
const reforzadoraUnitOf = (groupName: string) => {
  const m = groupName.match(/^Bomba reforzadora (\d+)$/i);
  return m ? Number(m[1]) : null;
};

// Alcance del edificio derivado de la precarga: sistemas presentes, nº de BOMBAS reales por
// sistema (excluye paneles, jockeys y generadores) y presencia de cada equipo gatillo.
export type BuildingScope = {
  systems: Set<string>;
  pumpCounts: Map<string, number>;
  hasPanel: boolean;
  hasJockey: boolean;
  hasFirePump: boolean; // bomba contra incendios NORMADA (NFPA)
  hasFireNoNormada: boolean; // bomba contra incendios NO normada (checklist propio)
  hasGenerator: boolean;
};

// Alcance vacío = "no filtrar". Los consumidores lo usan en vez de construirlo a mano,
// así agregar un campo a BuildingScope no obliga a tocar cada call site.
export const EMPTY_SCOPE: BuildingScope = {
  systems: new Set(),
  pumpCounts: new Map(),
  hasPanel: false,
  hasJockey: false,
  hasFirePump: false,
  hasFireNoNormada: false,
  hasGenerator: false,
};

export const buildBuildingScope = (rows: EquipmentRow[]): BuildingScope => {
  const systems = new Set<string>();
  const pumpCounts = new Map<string, number>();
  let hasPanel = false;
  let hasJockey = false;
  let hasFirePump = false;
  let hasFireNoNormada = false;
  let hasGenerator = false;

  for (const r of rows) {
    if (!r.system) continue;
    systems.add(r.system);

    switch (classifyEquipment(r)) {
      case "panel":
        hasPanel = true;
        break;
      case "jockey":
        hasJockey = true;
        break;
      case "generador":
        hasGenerator = true;
        break;
      case "bomba":
        pumpCounts.set(r.system, (pumpCounts.get(r.system) ?? 0) + 1);
        // Normada y no normada tienen secciones de checklist distintas.
        if (r.system === "contra_incendios") hasFirePump = true;
        if (r.system === "contra_incendios_no_normada") hasFireNoNormada = true;
        break;
    }
  }

  return {
    systems,
    pumpCounts,
    hasPanel,
    hasJockey,
    hasFirePump,
    hasFireNoNormada,
    hasGenerator,
  };
};

// Grupos que dependen de que el edificio TENGA ese equipo, no de que tenga el sistema.
// Un edificio con bomba contra incendios no normada (sin panel, sin jockey) ya no arrastra
// las secciones de Tablero ni de Jockey. — pregunta de William, 10-jul.
const GROUP_TO_REQUIREMENT: Record<string, (s: BuildingScope) => boolean> = {
  Tablero: (s) => s.hasPanel,
  "Bomba Jockey": (s) => s.hasJockey,
  "Bomba contra incendio": (s) => s.hasFirePump,
  "Bomba contra incendio (no normada)": (s) => s.hasFireNoNormada,
  "Planta electrica": (s) => s.hasGenerator,
};

// Versión normalizada del mapa de requisitos. El template de prod trae el MISMO grupo
// con dos grafías ("Planta electrica" y "Planta eléctrica"); sin normalizar, la acentuada
// no casaba y la sección se mostraba siempre. Se busca por `norm(group)`.
const GROUP_TO_REQUIREMENT_NORM: Record<
  string,
  (s: BuildingScope) => boolean
> = Object.fromEntries(
  Object.entries(GROUP_TO_REQUIREMENT).map(([k, v]) => [norm(k), v])
);

// ¿Este ítem aplica al edificio? Combina conteo por unidad (principales/reforzadoras),
// filtro por subtipo (sumergibles) y presencia del equipo (resto). Debe usarse igual en el
// render, el guardado y el PDF para que no se desincronicen.
export const itemAppliesToBuilding = (label: string, scope: BuildingScope) => {
  const group = groupOf(label);
  const groupNorm = norm(group);

  // Principales: una "Bomba N" por cada bomba de transferencia. Sin bombas → grupo oculto.
  if (groupNorm === "bombas principales") {
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

  // Sumergibles: solo los subtipos cuyo sistema esté presente, y dentro de cada subtipo,
  // solo tantas unidades como bombas tenga el edificio. El 3er segmento es la unidad
  // ("Sistema pluvial - Pluvial 2 - ...", "Foso elevador - Bomba 1 - ..."). Si no trae
  // número (ej. "Sanitario", "Estado del foso") → ítem compartido, se muestra igual.
  if (groupNorm === "bombas sumergibles") {
    const sys = SUBMERSIBLE_SUBTYPE_TO_SYSTEM_NORM[norm(subtypeOf(label))];
    if (!sys) return true;
    if (!scope.systems.has(sys)) return false;
    const parts = label.split(" - ");
    const unitMatch = (parts[2] ?? "").trim().match(/(\d+)$/);
    if (!unitMatch) return true;
    return Number(unitMatch[1]) <= (scope.pumpCounts.get(sys) ?? 0);
  }

  // Resto: gatillado por equipo → presencia real; general/administrativo → siempre.
  const requirement = GROUP_TO_REQUIREMENT_NORM[groupNorm];
  return requirement ? requirement(scope) : true;
};
