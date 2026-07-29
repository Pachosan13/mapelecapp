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
  // `specs.verificado === false` marca inventario que entró por lectura automática de
  // las hojas de mantenimiento (28-jul) y que SEMCO todavía no revisó.
  specs?: unknown;
};

// Un equipo está sin verificar solo si lo dice explícitamente. Los que William cargó a
// mano no traen la marca y cuentan como buenos: la ausencia no es sospecha.
export const equipoSinVerificar = (row: EquipmentRow): boolean =>
  typeof row.specs === "object" &&
  row.specs !== null &&
  (row.specs as { verificado?: unknown }).verificado === false;

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

// ¿Es la plantilla de presurización de escaleras? Trae "Ventilador 1..4" fijos y hay que
// recortarlos al nº real de ventiladores del edificio (Metro View tiene 1 por torre y le
// salían los 4 — feedback William 27-jul). Se detecta por NOMBRE, no por categoría: su
// categoría es `fire`, la misma que las plantillas NFPA de rociadores/bomba, que NO se
// filtran por inventario (decisión 15-jul: sus bloques siempre salen).
export const isPresurizacionTemplate = (templateName?: string | null) =>
  norm(templateName ?? "").includes("presurizacion");

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

export type EquipmentClass =
  | "panel"
  | "jockey"
  | "generador"
  | "ventilador"
  | "bomba";

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
  if (row.kind === "ventilador") return "ventilador";
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

// Nº de unidad de una bomba contra incendio NORMADA: grupo "Bomba contra incendio N".
// null si no aplica. Antes había una sola sección "Bomba contra incendio" (por presencia);
// se volvió por unidad el 29-jul porque un edificio con 2 bombas normadas (Colores: Sótano 4
// + Azotea) solo veía una — feedback William. El regex EXIGE el número al final, así que NO
// casa "Bomba contra incendio (no normada)" (esa sigue siendo sección única) ni el label
// viejo sin numerar "Bomba contra incendio" (que se sigue tratando por presencia mientras la
// migración no lo renumere — deploy va antes que la migración).
const fireUnitOf = (groupName: string) => {
  const m = groupName.match(/^Bomba contra incendio (\d+)$/i);
  return m ? Number(m[1]) : null;
};

// Nº de unidad de una bomba jockey: grupo "Bomba Jockey N". null si no aplica. Igual que la
// bomba de incendio: pasó de sección única a por-unidad el 29-jul (Colores tiene jockey en
// Sótano 4 y en Azotea, y William confirmó que la de azotea lleva su propio checklist). El
// label viejo sin numerar "Bomba Jockey" cae por presencia (hasJockey) hasta que la migración
// lo renumere.
const jockeyUnitOf = (groupName: string) => {
  const m = groupName.match(/^Bomba Jockey (\d+)$/i);
  return m ? Number(m[1]) : null;
};

// Nº de unidad de un ventilador de presurización: grupo "Ventilador N". null si no aplica.
// La plantilla de presurización de escaleras trae "Ventilador 1..12" sembrados (se extendió
// de 4 a 12 el 29-jul: edificios con más de 4 ventiladores, pregunta de William). Metro View
// tiene 1 por torre; el filtro recorta al nº real de cada edificio (`fanCount`).
const ventiladorUnitOf = (groupName: string) => {
  const m = groupName.match(/^Ventilador (\d+)$/i);
  return m ? Number(m[1]) : null;
};

// Cuántos ventiladores mostrar cuando el edificio TODAVÍA no registró los suyos (fanCount=0
// = "no sabemos", no "no tiene"). Es el default histórico: antes de extender la plantilla a
// 12 se mostraban "todos", y todos eran 4. Se conserva 4 a propósito — si mostráramos las 12
// unidades sembradas, cada edificio sin inventariar arrastraría 372 casillas de ventilador.
const DEFAULT_FAN_UNITS = 4;

// Alcance del edificio derivado de la precarga: sistemas presentes, nº de BOMBAS reales por
// sistema (excluye paneles, jockeys y generadores) y presencia de cada equipo gatillo.
export type BuildingScope = {
  systems: Set<string>;
  pumpCounts: Map<string, number>;
  // Cada tablero del formulario se gatilla por el panel de SU sistema (feedback William
  // 14-jul): antes bastaba "hay panel" para una sola sección "Tablero"; ahora cada sistema
  // con panel muestra el suyo (principales, reforzador, contra incendios, jockey).
  hasPrincipalesPanel: boolean; // panel del sistema de transferencia (bombas principales)
  hasReforzadorPanel: boolean; // panel del sistema reforzador de presión
  hasBciPanel: boolean; // panel de la bomba principal contra incendios (NFPA, normada)
  hasJockeyPanel: boolean; // panel de la bomba jockey (dentro de contra incendios normado)
  hasPluvialPanel: boolean; // panel de control de las bombas sumergibles pluviales
  // Nº de paneles pluviales = nº de FOSOS pluviales. William confirmó (29-jul) que cada foso
  // tiene su propio panel de control (que maneja sus 2-3 bombas). Es lo único que deja saber
  // cuántos fosos hay: el inventario guarda bombas sueltas, no fosos.
  pluvialPanelCount: number;
  hasSanitarioPanel: boolean; // panel de control de las bombas sumergibles sanitarias
  hasJockey: boolean;
  jockeyCount: number; // nº de bombas jockey (Sótano, Azotea…) para la sección por unidad
  hasFirePump: boolean; // bomba contra incendios NORMADA (NFPA)
  hasFireNoNormada: boolean; // bomba contra incendios NO normada (checklist propio)
  hasGenerator: boolean;
  // Ventiladores de presurización de escaleras registrados en el edificio.
  // 0 significa "no sabemos", NO "no tiene" — ver la regla en itemAppliesToBuilding.
  fanCount: number;
};

// Alcance vacío = "no filtrar". Los consumidores lo usan en vez de construirlo a mano,
// así agregar un campo a BuildingScope no obliga a tocar cada call site.
export const EMPTY_SCOPE: BuildingScope = {
  systems: new Set(),
  pumpCounts: new Map(),
  hasPrincipalesPanel: false,
  hasReforzadorPanel: false,
  hasBciPanel: false,
  hasJockeyPanel: false,
  hasPluvialPanel: false,
  pluvialPanelCount: 0,
  hasSanitarioPanel: false,
  hasJockey: false,
  jockeyCount: 0,
  hasFirePump: false,
  hasFireNoNormada: false,
  hasGenerator: false,
  fanCount: 0,
};

export const buildBuildingScope = (rows: EquipmentRow[]): BuildingScope => {
  // Mientras el edificio tenga UN equipo sin verificar, no se filtra nada: sale la
  // plantilla completa.
  //
  // Por qué (28-jul-2026): hasta hoy un edificio sin inventario mostraba el formulario
  // entero — el default seguro. Al cargar 97 edificios leídos de las hojas escaneadas,
  // esos formularios pasarían a filtrarse contra un inventario que nadie confirmó, y una
  // bomba que la lectura se comió le BORRARÍA la sección al técnico en campo. Mostrar de
  // más se ignora; mostrar de menos se pierde. El filtro se activa cuando William
  // termina de revisar el edificio.
  if (rows.some(equipoSinVerificar)) return EMPTY_SCOPE;

  const systems = new Set<string>();
  const pumpCounts = new Map<string, number>();
  let hasPrincipalesPanel = false;
  let hasReforzadorPanel = false;
  let hasBciPanel = false;
  let hasJockeyPanel = false;
  let hasPluvialPanel = false;
  let pluvialPanelCount = 0;
  let hasSanitarioPanel = false;
  let hasJockey = false;
  let jockeyCount = 0;
  let hasFirePump = false;
  let hasFireNoNormada = false;
  let hasGenerator = false;
  let fanCount = 0;

  for (const r of rows) {
    if (!r.system) continue;
    systems.add(r.system);

    switch (classifyEquipment(r)) {
      case "panel": {
        // El panel gatilla el tablero de su sistema. Dentro de contra incendios normado
        // hay dos: el de la bomba principal y el de la jockey — se distinguen por el nombre
        // (mismo criterio que classifyEquipment usa para no confundir panel con jockey).
        const nm = norm(r.name ?? "");
        if (r.system === "reforzador_agua_potable") hasReforzadorPanel = true;
        else if (r.system === "transferencia_agua_potable") hasPrincipalesPanel = true;
        else if (r.system === "contra_incendios") {
          if (/\bjockey\b/.test(nm)) hasJockeyPanel = true;
          else hasBciPanel = true;
        }
        // Sumergibles pluvial/sanitario a veces traen su propio panel de control
        // (contactor/térmica, supervisor de voltaje, luces piloto, alternador) —
        // feedback William 15-jul. Gatillan su sección solo si el edificio lo registra.
        else if (r.system === "achique_pluvial") {
          hasPluvialPanel = true;
          pluvialPanelCount += 1;
        }
        else if (r.system === "sanitario") hasSanitarioPanel = true;
        break;
      }
      case "jockey":
        hasJockey = true;
        jockeyCount += 1;
        break;
      case "generador":
        hasGenerator = true;
        break;
      case "ventilador":
        fanCount += 1;
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
    hasPrincipalesPanel,
    hasReforzadorPanel,
    hasBciPanel,
    hasJockeyPanel,
    hasPluvialPanel,
    pluvialPanelCount,
    hasSanitarioPanel,
    hasJockey,
    jockeyCount,
    hasFirePump,
    hasFireNoNormada,
    hasGenerator,
    fanCount,
  };
};

// Grupos que dependen de que el edificio TENGA ese equipo, no de que tenga el sistema.
// Un edificio con bomba contra incendios no normada (sin panel, sin jockey) ya no arrastra
// las secciones de Tablero ni de Jockey. — pregunta de William, 10-jul.
const GROUP_TO_REQUIREMENT: Record<string, (s: BuildingScope) => boolean> = {
  // "Tablero" (histórico) = el panel de bombas principales. Los demás tableros por sistema
  // se agregaron 14-jul (feedback William): reforzador con su tablero, y en contra incendios
  // normado el de la bomba principal y el de la jockey, cada uno gatillado por su panel.
  Tablero: (s) => s.hasPrincipalesPanel,
  "Tablero reforzador": (s) => s.hasReforzadorPanel,
  "Panel contra incendios": (s) => s.hasBciPanel,
  "Panel jockey": (s) => s.hasJockeyPanel,
  "Panel pluvial": (s) => s.hasPluvialPanel,
  "Panel sanitario": (s) => s.hasSanitarioPanel,
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

  // Bombas contra incendio normadas: igual que reforzadoras, una "Bomba contra incendio N"
  // por cada bomba normada del edificio. Los jockeys NO cuentan (classifyEquipment los saca
  // a "jockey", nunca entran en pumpCounts), así que el conteo son las bombas principales de
  // incendio (Sótano 4 + Azotea = 2 en Colores). El label viejo sin numerar cae abajo, en el
  // mapa por presencia (hasFirePump), hasta que la migración lo renumere a "... 1".
  const fireUnit = fireUnitOf(group);
  if (fireUnit !== null) {
    const count = scope.pumpCounts.get("contra_incendios") ?? 0;
    return fireUnit <= count;
  }

  // Bombas jockey por unidad: una "Bomba Jockey N" por cada jockey del edificio (Sótano 4 +
  // Azotea = 2 en Colores). Se cuenta aparte de las bombas (classifyEquipment las saca a
  // "jockey"), en scope.jockeyCount.
  const jockeyUnit = jockeyUnitOf(group);
  if (jockeyUnit !== null) {
    return jockeyUnit <= scope.jockeyCount;
  }

  // Ventiladores de presurización: un grupo por unidad, como las reforzadoras, PERO con
  // una regla asimétrica a propósito.
  //
  // Los ventiladores se empezaron a modelar como equipo el 27-jul; hasta entonces NINGÚN
  // edificio los tenía registrados. Si aplicáramos la regla normal (`unit <= count`), un
  // edificio con bombas cargadas pero sin ventiladores daría count=0 y escondería los 4
  // → el técnico no podría registrar ni el ventilador que sí existe. Eso es peor que el
  // problema original (a Metro View le salen 4 cuando tiene 1).
  //
  // Por eso: filtramos SOLO con evidencia positiva. fanCount === 0 significa "todavía no
  // sabemos", no "no tiene" → se muestra el default histórico (DEFAULT_FAN_UNITS = 4).
  // Antes se devolvía `true` (mostrar TODAS), pero al extender la plantilla de 4 a 12 (29-jul)
  // "todas" pasaría a ser 12 y cada edificio sin inventariar cargaría 12 ventiladores. Cuando
  // el edificio registre sus ventiladores, salen exactamente los que tiene, hasta 12.
  const fanUnit = ventiladorUnitOf(group);
  if (fanUnit !== null) {
    const cap = scope.fanCount === 0 ? DEFAULT_FAN_UNITS : scope.fanCount;
    return fanUnit <= cap;
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

    // Pluvial: modelo de dos niveles foso→bomba (29-jul, feedback William, Colores de Bella
    // Vista). El label es "… - Sistema pluvial - Pluvial N (foso) - Bomba M - campo". El nº de
    // fosos = nº de paneles pluviales (1 panel por foso). Antes se comparaba el índice de FOSO
    // contra el conteo de BOMBAS, así que 2 bombas mostraban 2 fosos (el bug que reportó).
    if (sys === "achique_pluvial") {
      const bombaCount = scope.pumpCounts.get("achique_pluvial") ?? 0;
      // Si no se inventarió panel pero hay bombas, hay al menos 1 foso (no esconder equipo real).
      const fosoCount =
        scope.pluvialPanelCount > 0 ? scope.pluvialPanelCount : bombaCount > 0 ? 1 : 0;
      const foso = Number((parts[2] ?? "").trim().match(/(\d+)$/)?.[1] ?? NaN);
      if (Number.isNaN(foso)) return true;
      if (foso > fosoCount) return false; // foso gate
      const bombaMatch = (parts[3] ?? "").trim().match(/^Bomba (\d+)$/i);
      if (!bombaMatch) return true; // "Estado del foso" / "Panel de control" → nivel foso
      // Un solo foso: todas las bombas pluviales son de ese foso (exacto). Multi-foso: no
      // sabemos el reparto por foso, así que se muestran todos los slots sembrados y el técnico
      // deja en blanco el que sobre (mostrar de más se ignora; de menos se pierde).
      if (fosoCount === 1) return Number(bombaMatch[1]) <= bombaCount;
      return true;
    }

    const unitMatch = (parts[2] ?? "").trim().match(/(\d+)$/);
    if (!unitMatch) return true;
    return Number(unitMatch[1]) <= (scope.pumpCounts.get(sys) ?? 0);
  }

  // Resto: gatillado por equipo → presencia real; general/administrativo → siempre.
  // La plantilla de prod llama al grupo "Planta de Emergencia"; el mapa solo conocía
  // "Planta electrica", así que NINGÚN edificio casaba y la sección de planta se colaba
  // en todos los formularios — la vio William el 28-jul al asignar un mantenimiento en
  // PH. NUOVO RESIDENCES, que no tiene planta. Se matchea por PREFIJO para cubrir las dos
  // grafías y los labels mal formados del template ("Planta de Emergencia- Modelo", sin
  // espacio antes del guion, que `groupOf` parte como un grupo distinto).
  // Se mira la ETIQUETA completa, no el grupo: tres ítems del template vienen como
  // "Planta de Emergencia- Modelo" (sin espacio antes del guion), y `groupOf` los manda a
  // "Datos generales", donde ningún requisito los alcanzaba.
  const labelNorm = norm(label);
  if (labelNorm.startsWith("planta de emergencia") || labelNorm.startsWith("planta electrica")) {
    return scope.hasGenerator;
  }

  const requirement = GROUP_TO_REQUIREMENT_NORM[groupNorm];
  return requirement ? requirement(scope) : true;
};
