import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSpecs, equipmentTypeFor } from "./specs.ts";

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
