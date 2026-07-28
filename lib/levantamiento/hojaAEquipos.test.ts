import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hojaAEquipos, type HojaLeida } from "./hojaAEquipos.ts";

const bombas = (n: number) =>
  Array.from({ length: 3 }, (_, i) => ({ indice: i + 1, presente: i < n }));

const hojaBase: HojaLeida = {
  numero_reporte: "16164",
  fecha: "11/6/2026",
  tecnico_encargado: "José Perea",
  bombas_principales: bombas(0),
  bombas_reforzadoras: bombas(0),
  bombas_sumergibles: bombas(0),
  contra_incendios: { bomba_principal: false, bomba_jockey: false },
  planta_electrica: { presente: false },
  tableros_control: [],
};

const nombres = (h: HojaLeida) => hojaAEquipos(h, "edificio-1").map((e) => e.name);

describe("hojaAEquipos", () => {
  it("solo crea equipos por las columnas con datos escritos", () => {
    const eq = hojaAEquipos({ ...hojaBase, bombas_principales: bombas(2) }, "edificio-1");
    assert.deepEqual(eq.map((e) => e.name), ["Bomba Principal #1", "Bomba Principal #2"]);
    assert.equal(eq[0].system, "transferencia_agua_potable");
  });

  it("una hoja en blanco no inventa nada", () => {
    assert.deepEqual(hojaAEquipos(hojaBase, "edificio-1"), []);
  });

  // La regla de William (28-jul): la jockey llena implica sistema normado.
  it("jockey con datos → normada, con sus dos paneles de incendio", () => {
    const n = nombres({
      ...hojaBase,
      contra_incendios: { bomba_principal: true, bomba_jockey: true },
    });
    assert.deepEqual(n, [
      "Bomba Contra Incendios",
      "Bomba Jockey",
      "Panel de Control de Bomba Contra Incendios",
      "Panel de Control de Bomba Jockey",
    ]);
  });

  it("jockey vacía → no normada, sin jockey y sin paneles", () => {
    const eq = hojaAEquipos(
      { ...hojaBase, contra_incendios: { bomba_principal: true, bomba_jockey: false } },
      "edificio-1"
    );
    assert.deepEqual(eq.map((e) => e.name), ["Bomba Contra Incendios"]);
    assert.equal(eq[0].system, "contra_incendios_no_normada");
  });

  it("los paneles de incendio NO salen del bloque TABLERO de la hoja", () => {
    // En P.H. ALTO RIO ese bloque venía vacío y los paneles sí existen: los pone
    // la regla de la jockey, no el papel.
    const n = nombres({
      ...hojaBase,
      contra_incendios: { bomba_principal: true, bomba_jockey: true },
      tableros_control: [{ sistema: "contra_incendios", presente: false }],
    });
    assert.ok(n.includes("Panel de Control de Bomba Contra Incendios"));
  });

  it("una sumergible sin rótulo queda sin sistema y pide confirmación", () => {
    const eq = hojaAEquipos({ ...hojaBase, bombas_sumergibles: bombas(1) }, "edificio-1");
    assert.equal(eq[0].system, null);
    assert.match(eq[0].notes, /SIN IDENTIFICAR/);
  });

  it("una sumergible rotulada conserva el rótulo del técnico en la nota", () => {
    const eq = hojaAEquipos(
      {
        ...hojaBase,
        bombas_sumergibles: [{ indice: 1, presente: true, etiqueta: "P.E" }],
      },
      "edificio-1"
    );
    assert.match(eq[0].notes, /"P\.E"/);
  });

  it("todo entra sin verificar y con la hoja de origen, para poder revertir", () => {
    const eq = hojaAEquipos({ ...hojaBase, planta_electrica: { presente: true } }, "edificio-1");
    const specs = eq[0].specs as { verificado: boolean; origen: { hoja: string } };
    assert.equal(specs.verificado, false);
    assert.equal(specs.origen.hoja, "16164");
    assert.match(eq[0].notes, /SIN VERIFICAR/);
  });

  it("equipment_type se deriva del sistema (NOT NULL en la tabla)", () => {
    const eq = hojaAEquipos(
      {
        ...hojaBase,
        bombas_principales: bombas(1),
        bombas_sumergibles: bombas(1),
        contra_incendios: { bomba_principal: true, bomba_jockey: true },
      },
      "edificio-1"
    );
    const tipo = Object.fromEntries(eq.map((e) => [e.name, e.equipment_type]));
    assert.equal(tipo["Bomba Principal #1"], "pump");
    assert.equal(tipo["Bomba Contra Incendios"], "fire");
    assert.equal(tipo["Bomba sumergible #1"], "pump");
  });
});
