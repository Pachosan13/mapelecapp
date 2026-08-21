import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBuildingScope,
  classifyEquipment,
  isBombasTemplate,
  isPresurizacionTemplate,
  itemAppliesToBuilding,
  type EquipmentRow,
} from "./checklistFilter.ts";

const bomba = (name: string, system: string): EquipmentRow => ({ name, system, kind: "bomba" });
const panel = (name: string, system: string): EquipmentRow => ({
  name,
  system,
  kind: "panel_control",
});
const generador = (name: string, system: string): EquipmentRow => ({
  name,
  system,
  kind: "generador",
});
const ventilador = (name: string, system: string): EquipmentRow => ({
  name,
  system,
  kind: "ventilador",
});

const applies = (label: string, rows: EquipmentRow[]) =>
  itemAppliesToBuilding(label, buildBuildingScope(rows));

describe("isBombasTemplate", () => {
  it("acepta el nombre real de la plantilla, con guion largo o corto", () => {
    assert.equal(isBombasTemplate("Mantenimiento – Bombas"), true);
    assert.equal(isBombasTemplate("mantenimiento - bombas"), true);
  });

  it("acepta por categoría", () => {
    assert.equal(isBombasTemplate("Otro nombre", "bombas"), true);
  });

  it("rechaza las otras plantillas reales", () => {
    assert.equal(isBombasTemplate("IPM DE BOMBA CONTRA INCENDIO NFPA25", "fire"), false);
    assert.equal(isBombasTemplate("MANTENIMIENTO MENSUAL SISTEMA DE PRESURIZACIÓN DE ESCALERAS", "fire"), false);
    assert.equal(isBombasTemplate(null, null), false);
  });
});

describe("classifyEquipment", () => {
  it("usa kind cuando es confiable", () => {
    assert.equal(classifyEquipment(panel("Panel de Control", "contra_incendios")), "panel");
    assert.equal(classifyEquipment(generador("Planta de Emergencia", "planta_diesel")), "generador");
    assert.equal(classifyEquipment(bomba("Bomba Contra Incendios", "contra_incendios")), "bomba");
  });

  it("detecta un panel guardado con kind='bomba' por su nombre", () => {
    // Fila real: Evergreen Torre A.
    const row = bomba("Panel de Control de Bomba Contra Incendios", "contra_incendios");
    assert.equal(classifyEquipment(row), "panel");
  });

  it("un panel de bomba jockey es panel, no jockey", () => {
    // Fila real: P.H MAREA I. El orden panel-antes-que-jockey es lo que lo salva.
    const row = bomba("Panel de Control de la Bomba Jockey de la Azotea", "contra_incendios");
    assert.equal(classifyEquipment(row), "panel");
    assert.equal(classifyEquipment(panel("Panel de Control de Bomba Jockey PB", "contra_incendios")), "panel");
  });

  it("detecta la bomba jockey por nombre", () => {
    assert.equal(classifyEquipment(bomba("Bomba Jockey", "contra_incendios")), "jockey");
    assert.equal(classifyEquipment(bomba("Bomba Jockey PB", "contra_incendios")), "jockey");
  });

  it("no confunde una bomba normal con jockey", () => {
    assert.equal(classifyEquipment(bomba("Bomba Principal NFPA UL+FM", "contra_incendios")), "bomba");
  });
});

describe("Panel de Control - Bombas Principales (grupo Tablero)", () => {
  const label = "Tablero - Luces piloto ok";

  it("se muestra si el sistema de transferencia tiene panel", () => {
    assert.equal(
      applies(label, [panel("Panel de Control de Bombas Principales", "transferencia_agua_potable")]),
      true
    );
  });

  it("se muestra aunque el panel esté mal tipado como bomba", () => {
    assert.equal(
      applies(label, [bomba("Panel de Control de Bombas Principales", "transferencia_agua_potable")]),
      true
    );
  });

  it("NO se muestra si el único panel es de otro sistema (contra incendios)", () => {
    // Modelo por-sistema (14-jul): el tablero de principales lo gatilla SU panel, no cualquiera.
    assert.equal(
      applies(label, [panel("Panel de Control de Bomba Contra Incendios", "contra_incendios")]),
      false
    );
  });

  it("se oculta en una bomba contra incendios no normada, sin panel", () => {
    assert.equal(
      applies(label, [bomba("Bomba Contra Incendios", "contra_incendios_no_normada")]),
      false
    );
  });
});

describe("Panel de Control - Sistema Reforzador (grupo Tablero reforzador)", () => {
  const label = "Tablero reforzador - Supervisor de voltaje";

  it("se muestra si el reforzador tiene panel (ej. ELMARE 5000)", () => {
    assert.equal(
      applies(label, [panel("Panel de Control de Bombas Reforzadoras", "reforzador_agua_potable")]),
      true
    );
  });

  it("NO se muestra si el reforzador es solo contactor+térmica sin panel (ej. Belview 100)", () => {
    assert.equal(applies(label, [bomba("Bomba Reforzadora #1", "reforzador_agua_potable")]), false);
  });
});

describe("Panel de Control - Sistema Pluvial (grupo Panel pluvial)", () => {
  const label = "Panel pluvial - Supervisor de voltaje";

  it("se muestra si el sistema pluvial tiene panel de control registrado", () => {
    assert.equal(
      applies(label, [panel("Panel de Control Pluvial", "achique_pluvial")]),
      true
    );
  });

  it("NO se muestra si el pluvial solo tiene bombas sumergibles sin panel", () => {
    assert.equal(applies(label, [bomba("Bomba Pluvial 1", "achique_pluvial")]), false);
  });
});

describe("Panel de Control - Sistema Sanitario (grupo Panel sanitario)", () => {
  const label = "Panel sanitario - Contactor/Térmica #1";

  it("se muestra si el sistema sanitario tiene panel de control registrado", () => {
    assert.equal(
      applies(label, [panel("Panel de Control Sanitario", "sanitario")]),
      true
    );
  });

  it("NO se muestra si el sanitario solo tiene bombas sumergibles sin panel", () => {
    assert.equal(applies(label, [bomba("Bomba Sanitaria 1", "sanitario")]), false);
  });
});

describe("Panel de la Bomba Principal Contra Incendios (grupo Panel contra incendios)", () => {
  const label = "Panel contra incendios - Selector en AUTO";

  it("se muestra si hay panel BCI (no jockey) en contra incendios", () => {
    assert.equal(
      applies(label, [panel("Panel de Control de Bomba Contra Incendios", "contra_incendios")]),
      true
    );
  });

  it("NO se muestra si el único panel del sistema es el de la jockey", () => {
    assert.equal(
      applies(label, [panel("Panel de Control de la Bomba Jockey", "contra_incendios")]),
      false
    );
  });

  it("NO se muestra sin panel (solo la bomba)", () => {
    assert.equal(applies(label, [bomba("Bomba Contra Incendios", "contra_incendios")]), false);
  });
});

describe("Panel de la Bomba Jockey (grupo Panel jockey)", () => {
  const label = "Panel jockey - Contactor en buen estado";

  it("se muestra si hay panel de la jockey", () => {
    assert.equal(
      applies(label, [panel("Panel de Control de la Bomba Jockey", "contra_incendios")]),
      true
    );
  });

  it("NO se muestra si el único panel es el de la bomba principal contra incendios", () => {
    assert.equal(
      applies(label, [panel("Panel de Control de Bomba Contra Incendios", "contra_incendios")]),
      false
    );
  });
});

describe("grupo Bomba Jockey", () => {
  const label = "Bomba Jockey - Presión de arranque";

  it("se muestra solo si hay bomba jockey", () => {
    assert.equal(applies(label, [bomba("Bomba Jockey", "contra_incendios")]), true);
  });

  it("se oculta si solo hay bomba contra incendios", () => {
    assert.equal(applies(label, [bomba("Bomba Contra Incendios", "contra_incendios")]), false);
  });

  it("se oculta si lo único con 'jockey' en el nombre es un panel", () => {
    assert.equal(
      applies(label, [bomba("Panel de Control de la Bomba Jockey de la Azotea", "contra_incendios")]),
      false
    );
  });
});

describe("grupo Bomba contra incendio", () => {
  const label = "Bomba contra incendio - Voltaje L1-L2";

  it("se muestra si hay bomba en el sistema contra incendios", () => {
    assert.equal(applies(label, [bomba("Bomba Contra Incendios", "contra_incendios")]), true);
  });

  it("se oculta si el sistema solo tiene un panel (sin bomba)", () => {
    assert.equal(applies(label, [panel("Panel de Control", "contra_incendios")]), false);
  });

  it("una jockey sola no cuenta como bomba contra incendio", () => {
    assert.equal(applies(label, [bomba("Bomba Jockey", "contra_incendios")]), false);
  });
});

describe("bomba contra incendios NO normada", () => {
  const seccionPropia = "Bomba contra incendio (no normada) - Voltaje";
  const seccionNFPA = "Bomba contra incendio - Voltaje L1-L2";
  const tablero = "Tablero - Luces piloto ok";
  const jockey = "Bomba Jockey - Presión de arranque";
  const rowNoNormada = [bomba("Bomba CI sin norma", "contra_incendios_no_normada")];

  it("activa su sección propia (checklist tipo reforzadora sin tanque)", () => {
    assert.equal(applies(seccionPropia, rowNoNormada), true);
  });

  it("NO activa la sección NFPA (tiene otro protocolo)", () => {
    assert.equal(applies(seccionNFPA, rowNoNormada), false);
  });

  it("una bomba NORMADA no activa la sección de la no normada, y viceversa", () => {
    const normada = [bomba("Bomba CI", "contra_incendios")];
    assert.equal(applies(seccionPropia, normada), false);
    assert.equal(applies(seccionNFPA, normada), true);
  });

  it("sin panel no arrastra Tablero (el caso exacto de William)", () => {
    assert.equal(applies(tablero, rowNoNormada), false);
  });

  it("sin jockey no arrastra la sección Jockey", () => {
    assert.equal(applies(jockey, rowNoNormada), false);
  });
});

describe("grupo Planta electrica", () => {
  const label = "Planta electrica - Baterias ok";

  it("se muestra si hay generador", () => {
    assert.equal(applies(label, [generador("Planta de Emergencia", "planta_diesel")]), true);
  });

  it("se oculta si no hay generador", () => {
    assert.equal(applies(label, [bomba("Bomba Contra Incendios", "contra_incendios")]), false);
  });

  // Regresión (bug William, Belview Towers 300, 13-jul): el template de prod trae el grupo
  // con acento ("Planta eléctrica") ADEMÁS de sin acento. Antes del norm() la variante
  // acentuada no casaba su requisito y la sección se mostraba SIEMPRE, aunque el edificio
  // no tuviera generador — y editar equipos no la quitaba nunca.
  const labelAccent = "Planta eléctrica - Baterías ok";

  it("la grafía ACENTUADA también se oculta si no hay generador", () => {
    assert.equal(
      applies(labelAccent, [bomba("Bomba Contra Incendios", "contra_incendios")]),
      false
    );
  });

  it("la grafía ACENTUADA se muestra si hay generador", () => {
    assert.equal(
      applies(labelAccent, [generador("Planta de Emergencia", "planta_diesel")]),
      true
    );
  });
});

describe("conteo de bombas por unidad", () => {
  it("paneles y jockeys no inflan el conteo de bombas", () => {
    const rows = [
      bomba("Bomba 1", "transferencia_agua_potable"),
      bomba("Panel de Control de Transferencia", "transferencia_agua_potable"), // mal tipado
    ];
    assert.equal(applies("Bombas principales - Bomba 1 - Voltaje L1-L2", rows), true);
    // Sin el clasificador, el panel contaría como 2ª bomba y esta unidad se mostraría.
    assert.equal(applies("Bombas principales - Bomba 2 - Voltaje L1-L2", rows), false);
  });

  it("reforzadoras se muestran solo hasta el nº de bombas", () => {
    const rows = [
      bomba("Reforzadora 1", "reforzador_agua_potable"),
      bomba("Reforzadora 2", "reforzador_agua_potable"),
    ];
    assert.equal(applies("Bomba reforzadora 2 - Amperaje L1-L2", rows), true);
    assert.equal(applies("Bomba reforzadora 3 - Amperaje L1-L2", rows), false);
  });
});

describe("grupos generales y sumergibles", () => {
  it("los grupos administrativos siempre se muestran", () => {
    const rows = [bomba("Bomba Contra Incendios", "contra_incendios")];
    assert.equal(applies("Entrega - Fecha", rows), true);
    assert.equal(applies("Notes", rows), true);
  });

  it("los subtipos de sumergible siguen filtrando por sistema", () => {
    const rows = [bomba("Sumergible 1", "achique_pluvial")];
    assert.equal(applies("Bombas sumergibles - Sistema pluvial - Pluvial 1 - Voltaje", rows), true);
    assert.equal(applies("Bombas sumergibles - Foso elevador - Bomba 1 - Voltaje", rows), false);
  });

  it("no se toca ningún grupo de las otras plantillas (NFPA, ventiladores)", () => {
    const rows = [bomba("Bomba Contra Incendios", "contra_incendios")];
    assert.equal(applies("Ventilador 1 - Ubicación", rows), true);
    assert.equal(applies("Trimestral - Conexiones del cuerpo de bomberos (siamesa)", rows), true);
    assert.equal(applies("Sistema de bombas diésel - El nivel de electrolitos", rows), true);
  });
});

describe("presurización de escaleras — ventiladores", () => {
  it("detecta la plantilla por nombre, con y sin acento", () => {
    assert.equal(
      isPresurizacionTemplate("MANTENIMIENTO MENSUAL SISTEMA DE PRESURIZACIÓN DE ESCALERAS"),
      true
    );
    assert.equal(isPresurizacionTemplate("mantenimiento mensual presurizacion"), true);
    assert.equal(isPresurizacionTemplate("Mantenimiento – Bombas"), false);
    assert.equal(isPresurizacionTemplate(null), false);
  });

  it("classifyEquipment reconoce el ventilador por kind", () => {
    assert.equal(
      classifyEquipment({ name: "Ventilador presurización", system: "presurizacion_escaleras", kind: "ventilador" }),
      "ventilador"
    );
  });

  it("un ventilador registrado esconde los otros 3 (caso Metro View)", () => {
    const rows = [
      bomba("Bomba Principal 1", "transferencia_agua_potable"),
      ventilador("Ventilador presurización Torre A", "presurizacion_escaleras"),
    ];
    assert.equal(applies("Ventilador 1 - Ubicación", rows), true);
    assert.equal(applies("Ventilador 2 - Ubicación", rows), false);
    assert.equal(applies("Ventilador 4 - Ubicación", rows), false);
  });

  it("dos ventiladores muestran dos", () => {
    const rows = [
      ventilador("Ventilador Torre A", "presurizacion_escaleras"),
      ventilador("Ventilador Torre B", "presurizacion_escaleras"),
    ];
    assert.equal(applies("Ventilador 2 - Ubicación", rows), true);
    assert.equal(applies("Ventilador 3 - Ubicación", rows), false);
  });

  // La asimetría deliberada: sin ventiladores registrados NO escondemos nada, porque
  // 0 significa "no sabemos" (nadie los había modelado antes del 27-jul), no "no tiene".
  // Si esto se volviera `unit <= 0`, todo edificio con bombas perdería el formulario
  // completo de presurización — peor que el bug que arregla.
  it("sin ventiladores registrados se muestran los 4 (no sabemos ≠ no tiene)", () => {
    const rows = [bomba("Bomba Principal 1", "transferencia_agua_potable")];
    assert.equal(applies("Ventilador 1 - Ubicación", rows), true);
    assert.equal(applies("Ventilador 4 - Ubicación", rows), true);
  });

  // Techo de la plantilla extendido a 12 (29-jul). Sin dato del edificio se conserva el
  // default histórico de 4: los ventiladores 5..12 sembrados NO deben colarse en edificios
  // que nunca los registraron, o cada uno cargaría 372 casillas de más.
  it("sin ventiladores registrados NO se cuelan los sembrados 5..12", () => {
    const rows = [bomba("Bomba Principal 1", "transferencia_agua_potable")];
    assert.equal(applies("Ventilador 5 - Ubicación", rows), false);
    assert.equal(applies("Ventilador 12 - Ubicación", rows), false);
  });

  it("un edificio con 6 ventiladores muestra 1..6 y esconde el 7", () => {
    const rows = Array.from({ length: 6 }, (_, i) =>
      ventilador(`Ventilador Torre ${i + 1}`, "presurizacion_escaleras")
    );
    assert.equal(applies("Ventilador 4 - Ubicación", rows), true);
    assert.equal(applies("Ventilador 6 - Ubicación", rows), true);
    assert.equal(applies("Ventilador 7 - Ubicación", rows), false);
  });

  it("un edificio con 12 ventiladores muestra hasta el 12", () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      ventilador(`Ventilador Torre ${i + 1}`, "presurizacion_escaleras")
    );
    assert.equal(applies("Ventilador 12 - Ubicación", rows), true);
  });

  it("el ventilador no se cuenta como bomba de su sistema", () => {
    const scope = buildBuildingScope([
      ventilador("Ventilador Torre A", "presurizacion_escaleras"),
    ]);
    assert.equal(scope.fanCount, 1);
    assert.equal(scope.pumpCounts.get("presurizacion_escaleras") ?? 0, 0);
  });
});

// Bombas contra incendio normadas por unidad (29-jul-2026, feedback William — Colores de
// Bella Vista tiene bomba de incendio en Sótano 4 y en Azotea, y solo salía una).
describe("contra incendio — bombas normadas por unidad", () => {
  it("dos bombas de incendio muestran 1 y 2, esconden la 3 (caso Colores)", () => {
    const rows = [
      bomba("Bomba Contra Incendios Sótano 4", "contra_incendios"),
      bomba("Bomba Contra Incendios Azotea", "contra_incendios"),
    ];
    assert.equal(applies("Bomba contra incendio 1 - Voltaje L1-L2", rows), true);
    assert.equal(applies("Bomba contra incendio 2 - Voltaje L1-L2", rows), true);
    assert.equal(applies("Bomba contra incendio 3 - Voltaje L1-L2", rows), false);
  });

  it("los jockeys NO cuentan como bombas de incendio", () => {
    const rows = [
      bomba("Bomba Contra Incendios Sótano 4", "contra_incendios"),
      bomba("Bomba Jockey Azotea", "contra_incendios"),
    ];
    assert.equal(applies("Bomba contra incendio 1 - Voltaje L1-L2", rows), true);
    assert.equal(applies("Bomba contra incendio 2 - Voltaje L1-L2", rows), false);
  });

  // Transición: el filtro se despliega ANTES que la migración que renumera. Mientras tanto
  // el label viejo sin número se sigue tratando por presencia (hasFirePump), como siempre.
  it("el label viejo sin numerar se muestra por presencia hasta la migración", () => {
    const conBomba = [bomba("Bomba Contra Incendios", "contra_incendios")];
    const sinBomba = [bomba("Bomba Principal 1", "transferencia_agua_potable")];
    assert.equal(applies("Bomba contra incendio - Voltaje L1-L2", conBomba), true);
    assert.equal(applies("Bomba contra incendio - Voltaje L1-L2", sinBomba), false);
  });

  // La (no normada) es sección única aparte: el filtro por unidad NO la toca, y depende de
  // que el edificio tenga una bomba en el sistema no normado, no de la normada.
  it("la (no normada) sigue por presencia, independiente de la normada", () => {
    const soloNormada = [bomba("Bomba Contra Incendios", "contra_incendios")];
    const noNormada = [bomba("BCI patio", "contra_incendios_no_normada")];
    assert.equal(applies("Bomba contra incendio (no normada) - Voltaje L1-L2", soloNormada), false);
    assert.equal(applies("Bomba contra incendio (no normada) - Voltaje L1-L2", noNormada), true);
  });
});

// Bombas jockey por unidad (29-jul-2026, feedback William — Colores tiene jockey en Sótano 4
// y en Azotea, cada una con su checklist).
describe("contra incendio — bombas jockey por unidad", () => {
  it("dos jockeys cuentan y se muestran 1 y 2, no 3 (caso Colores)", () => {
    const rows = [
      bomba("Bomba Jockey Sótano 4", "contra_incendios"),
      bomba("Bomba Jockey Azotea", "contra_incendios"),
    ];
    const scope = buildBuildingScope(rows);
    assert.equal(scope.jockeyCount, 2);
    assert.equal(applies("Bomba Jockey 1 - Presión de arranque", rows), true);
    assert.equal(applies("Bomba Jockey 2 - Presión de arranque", rows), true);
    assert.equal(applies("Bomba Jockey 3 - Presión de arranque", rows), false);
  });

  it("el jockey no infla el conteo de bombas de incendio y viceversa", () => {
    const rows = [
      bomba("Bomba Contra Incendios Sótano 4", "contra_incendios"),
      bomba("Bomba Jockey Sótano 4", "contra_incendios"),
    ];
    const scope = buildBuildingScope(rows);
    assert.equal(scope.jockeyCount, 1);
    assert.equal(scope.pumpCounts.get("contra_incendios"), 1);
    assert.equal(applies("Bomba Jockey 2 - Presión de arranque", rows), false);
    assert.equal(applies("Bomba contra incendio 2 - Voltaje L1-L2", rows), false);
  });

  // Transición: el label viejo sin numerar se sigue tratando por presencia hasta la migración.
  it("el label viejo 'Bomba Jockey' se muestra por presencia hasta la migración", () => {
    const conJockey = [bomba("Bomba Jockey", "contra_incendios")];
    const sinJockey = [bomba("Bomba Principal 1", "transferencia_agua_potable")];
    assert.equal(applies("Bomba Jockey - Presión de arranque", conJockey), true);
    assert.equal(applies("Bomba Jockey - Presión de arranque", sinJockey), false);
  });
});

// Pluvial: modelo foso→bombas (29-jul, feedback William — Colores de Bella Vista: 1 foso con
// 2 bombas salía como 2 fosos). Nº de fosos = nº de paneles pluviales.
describe("bombas sumergibles pluviales — foso = panel", () => {
  const P = "Bombas sumergibles - Sistema pluvial";

  it("1 panel + 2 bombas = 1 foso con sus 2 bombas (caso Colores)", () => {
    const rows = [
      panel("Panel de Control de Bombas Pluviales", "achique_pluvial"),
      bomba("Bomba Pluvial #1", "achique_pluvial"),
      bomba("Bomba Pluvial #2", "achique_pluvial"),
    ];
    assert.equal(buildBuildingScope(rows).pluvialPanelCount, 1);
    assert.equal(applies(`${P} - Pluvial 1 - Bomba 1 - Voltaje L1-L2 (V)`, rows), true);
    assert.equal(applies(`${P} - Pluvial 1 - Bomba 2 - Voltaje L1-L2 (V)`, rows), true);
    assert.equal(applies(`${P} - Pluvial 1 - Estado del foso`, rows), true);
    assert.equal(applies(`${P} - Pluvial 2 - Bomba 1 - Voltaje L1-L2 (V)`, rows), false);
  });

  it("1 foso con 4 bombas muestra hasta la Bomba 4 (foso de 4, raro pero soportado)", () => {
    const rows = [
      panel("Panel de Control de Bombas Pluviales", "achique_pluvial"),
      ...Array.from({ length: 4 }, (_, i) => bomba(`Bomba Pluvial #${i + 1}`, "achique_pluvial")),
    ];
    assert.equal(applies(`${P} - Pluvial 1 - Bomba 4 - Voltaje L1-L2 (V)`, rows), true);
    assert.equal(applies(`${P} - Pluvial 2 - Bomba 1 - Voltaje L1-L2 (V)`, rows), false);
  });

  it("sin panel inventariado pero con bombas → al menos 1 foso (no esconder equipo)", () => {
    const rows = [
      bomba("Bomba Pluvial #1", "achique_pluvial"),
      bomba("Bomba Pluvial #2", "achique_pluvial"),
    ];
    assert.equal(applies(`${P} - Pluvial 1 - Bomba 2 - Voltaje L1-L2 (V)`, rows), true);
    assert.equal(applies(`${P} - Pluvial 2 - Bomba 1 - Voltaje L1-L2 (V)`, rows), false);
  });

  it("2 paneles = 2 fosos; el 3ro se esconde y las bombas no se recortan dentro", () => {
    const rows = [
      panel("Panel Pluvial A", "achique_pluvial"),
      panel("Panel Pluvial B", "achique_pluvial"),
      bomba("Bomba Pluvial #1", "achique_pluvial"),
      bomba("Bomba Pluvial #2", "achique_pluvial"),
      bomba("Bomba Pluvial #3", "achique_pluvial"),
    ];
    assert.equal(buildBuildingScope(rows).pluvialPanelCount, 2);
    assert.equal(applies(`${P} - Pluvial 1 - Bomba 1 - Voltaje L1-L2 (V)`, rows), true);
    assert.equal(applies(`${P} - Pluvial 2 - Bomba 3 - Voltaje L1-L2 (V)`, rows), true);
    assert.equal(applies(`${P} - Pluvial 3 - Bomba 1 - Voltaje L1-L2 (V)`, rows), false);
  });

  // GREENWOOD PLAZA, 21-ago-2026. William: "aquí como confirmo que las 6 bombas pluviales me
  // salen? 2 bombas por cada foso… solo me aparecen 4 de 6". El edificio tiene las 6 bombas
  // cargadas y UN solo panel sumergible (además sin sistema asignado, así que ni contaba):
  // el foso único solo tiene 4 slots sembrados y las bombas 5 y 6 se quedaban sin dónde ir.
  it("6 bombas con 1 solo panel: se abre un 2º foso por capacidad y salen las 6", () => {
    const rows = [
      panel("Panel de Control de Bombas Pluviales", "achique_pluvial"),
      ...Array.from({ length: 6 }, (_, i) => bomba(`Bomba pluvial #${i + 1}`, "achique_pluvial")),
    ];
    // 6 bombas no caben en 1 foso (4 sembradas) → 2 fosos × 3 bombas = las 6, exacto.
    for (const f of [1, 2]) {
      for (const b of [1, 2, 3]) {
        assert.equal(applies(`${P} - Pluvial ${f} - Bomba ${b} - Voltaje L1-L2 (V)`, rows), true);
      }
      assert.equal(applies(`${P} - Pluvial ${f} - Bomba 4 - Voltaje L1-L2 (V)`, rows), false);
    }
    assert.equal(applies(`${P} - Pluvial 3 - Bomba 1 - Voltaje L1-L2 (V)`, rows), false);
  });

  it("6 bombas en 3 fosos (3 paneles) = 2 bombas por foso, como lo dictó William", () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => panel(`Panel Pluvial ${i + 1}`, "achique_pluvial")),
      ...Array.from({ length: 6 }, (_, i) => bomba(`Bomba pluvial #${i + 1}`, "achique_pluvial")),
    ];
    for (const f of [1, 2, 3]) {
      assert.equal(applies(`${P} - Pluvial ${f} - Bomba 2 - Voltaje L1-L2 (V)`, rows), true);
      assert.equal(applies(`${P} - Pluvial ${f} - Bomba 3 - Voltaje L1-L2 (V)`, rows), false);
    }
    assert.equal(applies(`${P} - Pluvial 4 - Bomba 1 - Voltaje L1-L2 (V)`, rows), false);
  });

  // Ubicación = foso (21-ago-2026). William, tras hablar con el técnico: "son 2 pluviales
  // dentro del cuarto de bombas, 2 pluviales normales en estacionamientos". El inventario ya
  // tiene la columna Ubicación; llenarla es lo único que dice QUÉ bomba va en QUÉ foso.
  const bombaEn = (name: string, location: string): EquipmentRow => ({
    name,
    system: "achique_pluvial",
    kind: "bomba",
    location,
  });

  it("la ubicación separa los fosos: 2 en cuarto de bombas + 2 en estacionamientos (Greenwood)", () => {
    const rows = [
      bombaEn("Bomba pluvial #1", "Cuarto de bombas"),
      bombaEn("Bomba pluvial #2", "Cuarto de bombas"),
      bombaEn("Bomba pluvial #3", "Estacionamientos"),
      bombaEn("Bomba pluvial #4", "Estacionamientos"),
    ];
    assert.deepEqual(buildBuildingScope(rows).pluvialBombasPorFoso, [2, 2]);
    for (const f of [1, 2]) {
      assert.equal(applies(`${P} - Pluvial ${f} - Bomba 2 - Voltaje L1-L2 (V)`, rows), true);
      assert.equal(applies(`${P} - Pluvial ${f} - Bomba 3 - Voltaje L1-L2 (V)`, rows), false);
      assert.equal(applies(`${P} - Pluvial ${f} - Estado del foso`, rows), true);
    }
    assert.equal(applies(`${P} - Pluvial 3 - Bomba 1 - Voltaje L1-L2 (V)`, rows), false);
  });

  it("fosos desiguales: la ubicación manda aunque el reparto no sea parejo", () => {
    const rows = [
      bombaEn("Bomba pluvial #1", "Sótano"),
      bombaEn("Bomba pluvial #2", "Sótano"),
      bombaEn("Bomba pluvial #3", "Sótano"),
      bombaEn("Bomba pluvial #4", "Azotea"),
    ];
    assert.deepEqual(buildBuildingScope(rows).pluvialBombasPorFoso, [1, 3]); // orden alfabético
    assert.equal(applies(`${P} - Pluvial 1 - Bomba 1 - Voltaje L1-L2 (V)`, rows), true);
    assert.equal(applies(`${P} - Pluvial 1 - Bomba 2 - Voltaje L1-L2 (V)`, rows), false);
    assert.equal(applies(`${P} - Pluvial 2 - Bomba 3 - Voltaje L1-L2 (V)`, rows), true);
    assert.equal(applies(`${P} - Pluvial 2 - Bomba 4 - Voltaje L1-L2 (V)`, rows), false);
  });

  it("si los paneles piden más fosos que las ubicaciones, no se aprieta por ubicación", () => {
    // 3 paneles = 3 fosos, pero solo 2 ubicaciones llenas: no sabemos qué hay en el tercero.
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => panel(`Panel Pluvial ${i + 1}`, "achique_pluvial")),
      bombaEn("Bomba pluvial #1", "Cuarto de bombas"),
      bombaEn("Bomba pluvial #2", "Estacionamientos"),
    ];
    assert.equal(applies(`${P} - Pluvial 3 - Bomba 4 - Voltaje L1-L2 (V)`, rows), true);
  });

  it("ubicación a medias: las que no la traen quedan en su propio grupo, sin perder ninguna", () => {
    const rows = [
      bombaEn("Bomba pluvial #1", "Cuarto de bombas"),
      bombaEn("Bomba pluvial #2", "Cuarto de bombas"),
      bomba("Bomba pluvial #3", "achique_pluvial"),
    ];
    assert.deepEqual(buildBuildingScope(rows).pluvialBombasPorFoso, [1, 2]); // "" ordena primero
    assert.equal(applies(`${P} - Pluvial 1 - Bomba 1 - Voltaje L1-L2 (V)`, rows), true);
    assert.equal(applies(`${P} - Pluvial 2 - Bomba 2 - Voltaje L1-L2 (V)`, rows), true);
    assert.equal(applies(`${P} - Pluvial 2 - Bomba 3 - Voltaje L1-L2 (V)`, rows), false);
  });

  it("un foso con más bombas de las sembradas descarta la ubicación y abre fosos por capacidad", () => {
    const rows = Array.from({ length: 5 }, (_, i) => bombaEn(`Bomba pluvial #${i + 1}`, "Sótano"));
    assert.deepEqual(buildBuildingScope(rows).pluvialBombasPorFoso, []); // 5 > 4 sembradas
    let slots = 0;
    for (let f = 1; f <= 4; f++) {
      for (let b = 1; b <= 4; b++) {
        if (applies(`${P} - Pluvial ${f} - Bomba ${b} - Voltaje L1-L2 (V)`, rows)) slots++;
      }
    }
    assert.ok(slots >= 5, `5 bombas en un foso solo dieron ${slots} slots`);
  });

  it("ninguna bomba pluvial se queda sin slot, reparta como reparta", () => {
    // Invariante: los slots visibles (fosos × bombas por foso) nunca son menos que las
    // bombas inventariadas. Es la regla de la casa: mostrar de más se ignora, de menos se pierde.
    for (let paneles = 0; paneles <= 4; paneles++) {
      for (let bombas = 1; bombas <= 12; bombas++) {
        // ubicaciones = en cuántos fosos se reparten (0 = nadie llenó el campo)
        for (let ubicaciones = 0; ubicaciones <= 4; ubicaciones++) {
        const rows = [
          ...Array.from({ length: paneles }, (_, i) => panel(`Panel ${i + 1}`, "achique_pluvial")),
          ...Array.from({ length: bombas }, (_, i) =>
            ubicaciones === 0
              ? bomba(`Bomba #${i + 1}`, "achique_pluvial")
              : bombaEn(`Bomba #${i + 1}`, `Foso ${(i % ubicaciones) + 1}`)
          ),
        ];
        let slots = 0;
        for (let f = 1; f <= 4; f++) {
          for (let b = 1; b <= 4; b++) {
            if (applies(`${P} - Pluvial ${f} - Bomba ${b} - Voltaje L1-L2 (V)`, rows)) slots++;
          }
        }
        assert.ok(
          slots >= Math.min(bombas, 16),
          `${paneles} paneles + ${bombas} bombas en ${ubicaciones} ubicaciones → solo ${slots} slots`
        );
        }
      }
    }
  });
});

// --- Guarda de inventario sin verificar (28-jul-2026) ---
//
// Al cargar 97 edificios leídos de las hojas escaneadas, sus formularios pasarían a
// filtrarse contra un inventario que SEMCO no confirmó. Una bomba que la lectura se comió
// le borraría la sección al técnico en campo, y eso no se recupera. Hasta que William
// verifique, sale la plantilla completa.
describe("buildBuildingScope — equipo sin verificar", () => {
  const bomba = { name: "Bomba Principal #1", system: "transferencia_agua_potable", kind: "bomba" };

  it("un solo equipo sin verificar apaga TODO el filtro del edificio", () => {
    const scope = buildBuildingScope([
      { ...bomba, specs: { verificado: true } },
      { name: "Bomba Jockey", system: "contra_incendios", kind: "bomba", specs: { verificado: false } },
    ]);
    assert.equal(scope.systems.size, 0);
    assert.equal(scope.pumpCounts.size, 0);
    assert.equal(scope.hasJockey, false);
  });

  it("el inventario cargado a mano (sin la marca) sigue filtrando igual que siempre", () => {
    const scope = buildBuildingScope([bomba, { ...bomba, name: "Bomba Principal #2" }]);
    assert.ok(scope.systems.has("transferencia_agua_potable"));
    assert.equal(scope.pumpCounts.get("transferencia_agua_potable"), 2);
  });

  it("ya verificado por SEMCO → el filtro se activa", () => {
    const scope = buildBuildingScope([{ ...bomba, specs: { verificado: true } }]);
    assert.equal(scope.pumpCounts.get("transferencia_agua_potable"), 1);
  });

  it("specs con otra forma no se confunde con 'sin verificar'", () => {
    const scope = buildBuildingScope([{ ...bomba, specs: { voltaje: 480 } }]);
    assert.ok(scope.systems.has("transferencia_agua_potable"));
  });
});

// --- La sección de planta se colaba en todos los formularios (William, 28-jul) ---
describe("grupo Planta de Emergencia", () => {
  const conPlanta = buildBuildingScope([
    { name: "Bomba Principal #1", system: "transferencia_agua_potable", kind: "bomba" },
    { name: "Planta de Emergencia", system: "planta_diesel", kind: "generador" },
  ]);
  const sinPlanta = buildBuildingScope([
    { name: "Bomba Principal #1", system: "transferencia_agua_potable", kind: "bomba" },
  ]);

  it("sin generador registrado, la sección NO se muestra", () => {
    assert.equal(itemAppliesToBuilding("Planta de Emergencia - Nivel de combustible", sinPlanta), false);
  });

  it("con generador, sí", () => {
    assert.equal(itemAppliesToBuilding("Planta de Emergencia - Nivel de combustible", conPlanta), true);
  });

  it("los labels mal formados del template también se filtran", () => {
    // "Planta de Emergencia- Modelo" (sin espacio antes del guion) queda como grupo
    // aparte; sin el match por prefijo se colaba igual.
    assert.equal(itemAppliesToBuilding("Planta de Emergencia- Modelo", sinPlanta), false);
    assert.equal(itemAppliesToBuilding("Planta de Emergencia- Modelo", conPlanta), true);
  });

  it("la grafía vieja del mapa sigue funcionando", () => {
    assert.equal(itemAppliesToBuilding("Planta electrica - Nivel de combustible", sinPlanta), false);
    assert.equal(itemAppliesToBuilding("Planta eléctrica - Nivel de combustible", conPlanta), true);
  });
});

// ── Tableros por unidad (7-ago-2026) ────────────────────────────────────────────
// Un edificio puede tener DOS paneles del mismo sistema. Con el booleano viejo salía una
// sola sección y el segundo panel se perdía — William, Elite 400 (dos paneles de principales,
// uno por par de bombas) y Elite 500 (incendios y jockey en Azotea Y en Planta Baja).
describe("tableros por unidad", () => {
  const panel = (name: string, system: string): EquipmentRow => ({
    name,
    system,
    kind: "panel_control",
  });

  it("dos paneles de principales muestran Tablero 1 y Tablero 2", () => {
    const scope = buildBuildingScope([
      bomba("Bomba Principal #1", "transferencia_agua_potable"),
      panel("Panel de Control de Bombas Principales", "transferencia_agua_potable"),
      panel("Panel de Control de Bombas Principales #3 Y #4", "transferencia_agua_potable"),
    ]);
    assert.equal(scope.principalesPanelCount, 2);
    assert.equal(itemAppliesToBuilding("Tablero 1 - Voltaje", scope), true);
    assert.equal(itemAppliesToBuilding("Tablero 2 - Voltaje", scope), true);
    assert.equal(itemAppliesToBuilding("Tablero 3 - Voltaje", scope), false);
  });

  it("un solo panel deja fuera el Tablero 2", () => {
    const scope = buildBuildingScope([
      bomba("Bomba Principal #1", "transferencia_agua_potable"),
      panel("Panel de Control de Bombas Principales", "transferencia_agua_potable"),
    ]);
    assert.equal(itemAppliesToBuilding("Tablero 1 - Voltaje", scope), true);
    assert.equal(itemAppliesToBuilding("Tablero 2 - Voltaje", scope), false);
  });

  it("el label viejo SIN numerar sigue valiendo como unidad 1", () => {
    const scope = buildBuildingScope([
      bomba("Bomba Principal #1", "transferencia_agua_potable"),
      panel("Panel de Control de Bombas Principales", "transferencia_agua_potable"),
    ]);
    assert.equal(itemAppliesToBuilding("Tablero - Voltaje", scope), true);
  });

  it("caso Elite 500: incendios y jockey en Azotea y en Planta Baja", () => {
    const scope = buildBuildingScope([
      bomba("Bomba Contra Incendios AZOTEA", "contra_incendios"),
      bomba("Bomba Contra Incendios PLANTA BAJA", "contra_incendios"),
      panel("Panel de Control de Bomba Contra Incendios Azotea", "contra_incendios"),
      panel("Panel de Control de Bomba Contra Incendios PLANTA BAJA", "contra_incendios"),
      panel("Panel de Control de Bomba Jockey Azotea", "contra_incendios"),
      panel("panel de Control de Bomba Jockey PLANTA BAJA", "contra_incendios"),
    ]);
    assert.equal(scope.bciPanelCount, 2);
    assert.equal(scope.jockeyPanelCount, 2);
    assert.equal(itemAppliesToBuilding("Panel contra incendios 2 - Voltaje", scope), true);
    assert.equal(itemAppliesToBuilding("Panel jockey 2 - Voltaje", scope), true);
    assert.equal(itemAppliesToBuilding("Panel contra incendios 3 - Voltaje", scope), false);
  });

  it("'Tablero reforzador' no se lo come el regex de 'Tablero'", () => {
    const scope = buildBuildingScope([
      bomba("Bomba Reforzadora #1", "reforzador_agua_potable"),
      panel("Panel de Control de Bombas Reforzadoras", "reforzador_agua_potable"),
    ]);
    assert.equal(scope.reforzadorPanelCount, 1);
    assert.equal(scope.principalesPanelCount, 0);
    assert.equal(itemAppliesToBuilding("Tablero reforzador 1 - Voltaje", scope), true);
    // Sin panel de principales, el Tablero de principales NO debe salir.
    assert.equal(itemAppliesToBuilding("Tablero 1 - Voltaje", scope), false);
  });

  it("sin ningún panel no sale ningún tablero", () => {
    const scope = buildBuildingScope([
      bomba("Bomba Principal #1", "transferencia_agua_potable"),
    ]);
    assert.equal(itemAppliesToBuilding("Tablero 1 - Voltaje", scope), false);
    assert.equal(itemAppliesToBuilding("Panel jockey 1 - Voltaje", scope), false);
  });
});
