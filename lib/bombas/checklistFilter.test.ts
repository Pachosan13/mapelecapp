import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBuildingScope,
  classifyEquipment,
  isBombasTemplate,
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

describe("grupo Tablero", () => {
  const label = "Tablero - Luces piloto ok";

  it("se muestra si el edificio tiene panel", () => {
    assert.equal(applies(label, [panel("Panel de Control", "contra_incendios")]), true);
  });

  it("se muestra si el panel está mal tipado como bomba", () => {
    assert.equal(
      applies(label, [bomba("Panel de Control de Bomba Contra Incendios", "contra_incendios")]),
      true
    );
  });

  it("se oculta en una bomba contra incendios no normada, sin panel", () => {
    // La pregunta de William: bomba contra incendios sin panel → sin sección de Tablero.
    assert.equal(applies(label, [bomba("Bomba Contra Incendios", "contra_incendios")]), false);
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
