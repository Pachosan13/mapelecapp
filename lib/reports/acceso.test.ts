import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decidirAccesoInforme, visitaEsFacturable } from "./acceso.ts";

describe("decidirAccesoInforme", () => {
  it("ops_manager y director: como siempre, por visita o por edificio+fecha", () => {
    for (const role of ["ops_manager", "director"]) {
      for (const visitId of ["v1", "", null, undefined]) {
        assert.deepEqual(decidirAccesoInforme({ role, visitId }), {
          ok: true,
          soloLectura: false,
          requiereVisitaCompletada: false,
        });
      }
    }
  });

  it("facturación con visita: permitido, solo lectura y exige visita completada", () => {
    assert.deepEqual(decidirAccesoInforme({ role: "facturacion", visitId: "v1" }), {
      ok: true,
      soloLectura: true,
      requiereVisitaCompletada: true,
    });
  });

  it("facturación NO puede pedir un informe por edificio+fecha (ese camino crea filas)", () => {
    for (const visitId of ["", null, undefined]) {
      const d = decidirAccesoInforme({ role: "facturacion", visitId });
      assert.equal(d.ok, false);
      if (!d.ok) assert.equal(d.status, 403);
    }
  });

  it("tech, sin rol y roles desconocidos: 403", () => {
    for (const role of ["tech", null, undefined, "", "admin", "FACTURACION"]) {
      const d = decidirAccesoInforme({ role, visitId: "v1" });
      assert.equal(d.ok, false, `rol ${String(role)}`);
      if (!d.ok) assert.equal(d.status, 403);
    }
  });
});

describe("visitaEsFacturable", () => {
  it("solo las completadas", () => {
    assert.equal(visitaEsFacturable("completed"), true);
    for (const e of ["planned", "in_progress", "", null, undefined]) {
      assert.equal(visitaEsFacturable(e), false, String(e));
    }
  });
});
