import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decidirCancelacion, limpiarMotivo, MOTIVO_MAX } from "./cancelar.ts";

describe("decidirCancelacion", () => {
  it("planeada sin datos: se puede cancelar", () => {
    assert.deepEqual(decidirCancelacion({ status: "planned", respuestas: 0, fotos: 0 }), { ok: true });
  });

  it("iniciada pero sin respuestas ni fotos (atascada): se puede cancelar", () => {
    assert.deepEqual(decidirCancelacion({ status: "in_progress", respuestas: 0, fotos: 0 }), { ok: true });
  });

  it("con respuestas o con fotos: se rechaza y dice cuántas", () => {
    for (const [respuestas, fotos] of [[3, 0], [0, 2], [5, 4]]) {
      const r = decidirCancelacion({ status: "in_progress", respuestas, fotos });
      assert.equal(r.ok, false);
      if (!r.ok) assert.match(r.motivo, new RegExp(`${respuestas} respuestas, ${fotos} fotos`));
    }
  });

  it("completada: nunca, aunque no tenga datos", () => {
    const r = decidirCancelacion({ status: "completed", respuestas: 0, fotos: 0 });
    assert.equal(r.ok, false);
  });

  it("ya cancelada: se rechaza (no se cancela dos veces)", () => {
    const r = decidirCancelacion({ status: "cancelled", respuestas: 0, fotos: 0 });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.motivo, /ya está cancelada/);
  });

  it("estado desconocido, vacío o 'missed': se rechaza", () => {
    for (const status of ["missed", "otro", "", null, undefined]) {
      assert.equal(decidirCancelacion({ status, respuestas: 0, fotos: 0 }).ok, false);
    }
  });
});

describe("limpiarMotivo", () => {
  it("vacío, solo espacios o nulo: sin motivo", () => {
    for (const v of ["", "   ", "\n\t", null, undefined]) assert.equal(limpiarMotivo(v), null);
  });

  it("recorta y junta espacios y saltos de línea", () => {
    assert.equal(limpiarMotivo("  Sacaron al técnico\n\npor un   correctivo  "), "Sacaron al técnico por un correctivo");
  });

  it("corta en el máximo y no deja un espacio al final", () => {
    const largo = limpiarMotivo("a".repeat(MOTIVO_MAX - 1) + " " + "b".repeat(50));
    assert.ok(largo !== null && largo.length <= MOTIVO_MAX);
    assert.equal(largo, largo!.trim());
  });
});
