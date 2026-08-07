import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SYSTEMS, photoSystemOptions } from "./systems.ts";

describe("photoSystemOptions", () => {
  test("con inventario, ofrece SOLO los sistemas del edificio", () => {
    const opts = photoSystemOptions([
      "contra_incendios",
      "transferencia_agua_potable",
    ]);
    assert.deepEqual(opts.map(([k]) => k), [
      "transferencia_agua_potable",
      "contra_incendios",
    ]);
    // Y con su nombre legible, no el código crudo.
    assert.equal(opts[1][1], "Contra incendios (NFPA)");
  });

  test("respeta el orden del catálogo, no el que venga del inventario", () => {
    const opts = photoSystemOptions(["planta_diesel", "transferencia_agua_potable"]);
    assert.deepEqual(opts.map(([k]) => k), [
      "transferencia_agua_potable",
      "planta_diesel",
    ]);
  });

  test("un sistema fuera del catálogo igual se puede elegir", () => {
    const opts = photoSystemOptions(["contra_incendios", "sistema_raro"]);
    assert.deepEqual(opts.map(([k]) => k), ["contra_incendios", "sistema_raro"]);
    assert.equal(opts[1][1], "sistema_raro");
  });

  test("ignora vacíos y espacios sin dejar opciones fantasma", () => {
    const opts = photoSystemOptions(["", "  ", "contra_incendios"]);
    assert.deepEqual(opts.map(([k]) => k), ["contra_incendios"]);
  });

  // Estos tres son el seguro de vida: si la lista sale vacía, el técnico no puede
  // tomar NINGUNA foto (elegir sistema es obligatorio). Nunca debe pasar.
  test("sin inventario cae al catálogo completo", () => {
    assert.deepEqual(photoSystemOptions([]), SYSTEMS);
  });

  test("null o undefined caen al catálogo completo", () => {
    assert.deepEqual(photoSystemOptions(null), SYSTEMS);
    assert.deepEqual(photoSystemOptions(undefined), SYSTEMS);
  });

  test("un inventario de puros vacíos cae al catálogo completo", () => {
    assert.deepEqual(photoSystemOptions(["", "   "]), SYSTEMS);
  });

  test("nunca devuelve una lista vacía", () => {
    for (const caso of [[], null, undefined, [""], ["x"], ["contra_incendios"]]) {
      assert.ok(
        photoSystemOptions(caso as string[] | null | undefined).length > 0,
        `quedó vacío con ${JSON.stringify(caso)}`
      );
    }
  });
});
