import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSpecs, equipmentTypeFor, mergeSpecsAlEditar } from "./specs.ts";

describe("equipmentTypeFor", () => {
  it("contra incendios normada → fire", () => {
    assert.equal(equipmentTypeFor("contra_incendios"), "fire");
  });

  it("contra incendios NO normada → fire (sigue siendo incendio)", () => {
    assert.equal(equipmentTypeFor("contra_incendios_no_normada"), "fire");
  });

  it("el resto → pump", () => {
    assert.equal(equipmentTypeFor("transferencia_agua_potable"), "pump");
    assert.equal(equipmentTypeFor("planta_diesel"), "pump");
  });
});

describe("buildSpecs", () => {
  const fd = (obj: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(obj)) f.append(k, v);
    return f;
  };

  it("bomba: toma hp/voltage/presión/caudal, ignora vacíos", () => {
    const specs = buildSpecs(fd({ hp: "10", voltage: "208", pressure_psi: "", flow_gpm: "66" }), "bomba");
    assert.deepEqual(specs, { hp: 10, voltage: 208, flow_gpm: 66 });
  });

  it("generador: kw con decimales", () => {
    const specs = buildSpecs(fd({ kw: "600.5", kva: "750" }), "generador");
    assert.deepEqual(specs, { kw: 600.5, kva: 750 });
  });

  it("descarta valores no numéricos", () => {
    const specs = buildSpecs(fd({ hp: "abc" }), "bomba");
    assert.deepEqual(specs, {});
  });
});

describe("mergeSpecsAlEditar", () => {
  const origen = { hoja: "16492", tecnico: "Luis Alonso" };
  const fuente = { quien: "William Rodriguez", via: "WhatsApp", fecha: "2026-09-08" };

  it("los datos de placa se reemplazan por los nuevos", () => {
    const out = mergeSpecsAlEditar({ hp: 5, flow_gpm: 300 }, { hp: 10 });
    assert.deepEqual(out, { hp: 10 });
  });

  // El caso real: William editó PH Costanera el 8-sep y la bomba perdió la marca de diésel,
  // y con ella la sección del manual Clarke de ese edificio.
  it("PRESERVA la marca de diésel al editar un dato de placa", () => {
    const out = mergeSpecsAlEditar(
      { hp: 5, origen, combustible: "diesel", combustible_fuente: fuente },
      { hp: 10 }
    );
    assert.equal(out.combustible, "diesel");
    assert.deepEqual(out.combustible_fuente, fuente);
    assert.equal(out.hp, 10);
  });

  it("preserva origen, como antes", () => {
    assert.deepEqual(mergeSpecsAlEditar({ origen }, {}).origen, origen);
  });

  it("NO preserva verificado: si alguien de SEMCO editó el equipo, ya lo miró", () => {
    assert.equal(mergeSpecsAlEditar({ verificado: false }, {}).verificado, undefined);
  });

  it("no inventa claves que el equipo no traía", () => {
    assert.deepEqual(mergeSpecsAlEditar({}, { hp: 10 }), { hp: 10 });
  });

  it("aguanta specs previas nulas o de otro tipo", () => {
    assert.deepEqual(mergeSpecsAlEditar(null, { hp: 10 }), { hp: 10 });
    assert.deepEqual(mergeSpecsAlEditar("basura", { hp: 10 }), { hp: 10 });
  });

  it("una marca de diésel en false o vacía también sobrevive (no se filtra por verdad)", () => {
    assert.equal(mergeSpecsAlEditar({ combustible: "" }, {}).combustible, "");
  });
});
