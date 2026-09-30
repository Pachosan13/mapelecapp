import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_DIAS,
  diasDelRango,
  esFechaValida,
  rangoPorPreset,
  resolverRango,
  sumarDias,
} from "./rango.ts";

const HOY = "2026-09-30"; // miércoles

describe("esFechaValida", () => {
  it("acepta una fecha real", () => assert.equal(esFechaValida("2026-09-30"), true));
  it("rechaza días que no existen, aunque tengan la forma correcta", () => {
    assert.equal(esFechaValida("2026-02-31"), false);
    assert.equal(esFechaValida("2026-13-01"), false);
  });
  it("rechaza vacío, basura y formatos distintos", () => {
    assert.equal(esFechaValida(""), false);
    assert.equal(esFechaValida(undefined), false);
    assert.equal(esFechaValida("30/09/2026"), false);
    assert.equal(esFechaValida("2026-9-3"), false);
  });
  it("acepta el 29 de febrero solo en año bisiesto", () => {
    assert.equal(esFechaValida("2028-02-29"), true);
    assert.equal(esFechaValida("2026-02-29"), false);
  });
});

describe("sumarDias / diasDelRango", () => {
  it("cruza el fin de mes y de año", () => {
    assert.equal(sumarDias("2026-09-30", 1), "2026-10-01");
    assert.equal(sumarDias("2026-01-01", -1), "2025-12-31");
  });
  it("cuenta ambos extremos", () => {
    assert.equal(diasDelRango("2026-09-24", "2026-09-30"), 7);
    assert.equal(diasDelRango("2026-09-30", "2026-09-30"), 1);
  });
});

describe("rangoPorPreset", () => {
  it("hoy y ayer", () => {
    assert.deepEqual(rangoPorPreset("hoy", HOY), { desde: HOY, hasta: HOY });
    assert.deepEqual(rangoPorPreset("ayer", HOY), { desde: "2026-09-29", hasta: "2026-09-29" });
  });
  it("últimos 7 días incluye hoy (7 días en total)", () => {
    const r = rangoPorPreset("7d", HOY);
    assert.deepEqual(r, { desde: "2026-09-24", hasta: HOY });
    assert.equal(diasDelRango(r.desde, r.hasta), 7);
  });
  it("este mes va del 1 a hoy", () => {
    assert.deepEqual(rangoPorPreset("mes", HOY), { desde: "2026-09-01", hasta: HOY });
  });
  it("mes pasado es el mes calendario completo anterior", () => {
    assert.deepEqual(rangoPorPreset("mes_pasado", HOY), { desde: "2026-08-01", hasta: "2026-08-31" });
  });
  it("mes pasado en enero cae en diciembre del año anterior", () => {
    assert.deepEqual(rangoPorPreset("mes_pasado", "2026-01-15"), { desde: "2025-12-01", hasta: "2025-12-31" });
  });
  it("mes pasado desde marzo respeta febrero corto", () => {
    assert.deepEqual(rangoPorPreset("mes_pasado", "2026-03-10"), { desde: "2026-02-01", hasta: "2026-02-28" });
  });
});

describe("resolverRango", () => {
  it("sin nada pedido usa los últimos 7 días", () => {
    const r = resolverRango({}, HOY);
    assert.equal(r.preset, "7d");
    assert.deepEqual([r.desde, r.hasta], ["2026-09-24", HOY]);
    assert.equal(r.aviso, null);
  });
  it("un preset válido manda; uno inventado cae al de siempre", () => {
    assert.equal(resolverRango({ preset: "mes" }, HOY).preset, "mes");
    assert.equal(resolverRango({ preset: "todo" }, HOY).preset, "7d");
  });
  it("desde y hasta válidos mandan sobre el preset", () => {
    const r = resolverRango({ preset: "hoy", desde: "2026-09-01", hasta: "2026-09-15" }, HOY);
    assert.deepEqual([r.desde, r.hasta], ["2026-09-01", "2026-09-15"]);
    assert.equal(r.preset, null);
  });
  it("si el rango personalizado coincide con un preset, lo marca activo", () => {
    assert.equal(resolverRango({ desde: "2026-09-01", hasta: HOY }, HOY).preset, "mes");
  });
  it("fechas al revés se voltean", () => {
    const r = resolverRango({ desde: "2026-09-15", hasta: "2026-09-01" }, HOY);
    assert.deepEqual([r.desde, r.hasta], ["2026-09-01", "2026-09-15"]);
  });
  it("hasta nunca pasa de hoy", () => {
    const r = resolverRango({ desde: "2026-09-20", hasta: "2026-12-31" }, HOY);
    assert.equal(r.hasta, HOY);
  });
  it("todo en el futuro se queda en hoy", () => {
    const r = resolverRango({ desde: "2027-01-01", hasta: "2027-01-10" }, HOY);
    assert.deepEqual([r.desde, r.hasta], [HOY, HOY]);
  });
  it("un rango demasiado largo se recorta conservando la fecha final, y avisa", () => {
    const r = resolverRango({ desde: "2025-01-01", hasta: HOY }, HOY);
    assert.equal(r.hasta, HOY);
    assert.equal(diasDelRango(r.desde, r.hasta), MAX_DIAS);
    assert.match(r.aviso ?? "", /92 días/);
  });
  it("con una sola fecha o basura, ignora el rango y usa el preset", () => {
    assert.equal(resolverRango({ desde: "2026-09-01" }, HOY).preset, "7d");
    assert.equal(resolverRango({ desde: "abc", hasta: "def" }, HOY).preset, "7d");
    assert.equal(resolverRango({ desde: "2026-02-31", hasta: "2026-03-01" }, HOY).preset, "7d");
  });
});
