import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nombreArchivoInforme, slugEdificio, tipoDePlantilla } from "./nombreArchivo.ts";

describe("nombre del PDF del informe (William, 24-sep)", () => {
  it("el ejemplo de William: fecha + proyecto + bombas", () => {
    assert.equal(
      nombreArchivoInforme("2026-09-24", "P.H. VIVA PLAZA", ["Mantenimiento – Bombas"]),
      "Informe-servicio-2026-09-24-Viva-Plaza-bombas.pdf"
    );
  });

  it("red húmeda", () => {
    assert.equal(
      nombreArchivoInforme("2026-09-24", "P.H. VIVA PLAZA", ["RED HÚMEDA CONTRA INCENDIOS"]),
      "Informe-servicio-2026-09-24-Viva-Plaza-red-humeda.pdf"
    );
  });

  it("informe del día con varias plantillas: todos los tipos, sin repetir", () => {
    assert.equal(
      nombreArchivoInforme("2026-09-24", "PH AQUAPOINT", [
        "Mantenimiento – Bombas",
        "MANTENIMIENTO MENSUAL SISTEMA DE PRESURIZACIÓN DE ESCALERAS",
        "Mantenimiento – Bombas",
      ]),
      "Informe-servicio-2026-09-24-Aquapoint-bombas-presurizacion.pdf"
    );
  });

  it("prefijos de PH y caracteres raros", () => {
    assert.equal(slugEdificio("PH. MAREA II"), "Marea-Ii");
    assert.equal(slugEdificio("P.H . VICTORY WELLNESS"), "Victory-Wellness");
    assert.equal(slugEdificio("181 - CQ - Apartamentos"), "181-Cq-Apartamentos");
    assert.equal(slugEdificio("PHOENIX TOWER"), "Phoenix-Tower");
    assert.equal(slugEdificio("Edificio Ñandú"), "Edificio-Nandu");
  });

  it("los demás tipos de plantilla", () => {
    assert.equal(tipoDePlantilla("INSPECCIÓN PRUEBA Y MANTENIMIENTO DE SISTEMAS DE ROCIADORES NFPA25"), "rociadores");
    assert.equal(tipoDePlantilla("RECORRIDO CONTRA INCENDIO"), "recorrido");
    assert.equal(tipoDePlantilla("IPM DE BOMBA CONTRA INCENDIO NFPA25"), "ipm-bomba");
    assert.equal(tipoDePlantilla("Algo nuevo"), null);
  });

  it("sin edificio ni plantilla conocida no se rompe", () => {
    assert.equal(nombreArchivoInforme("2026-09-24", null, ["Algo nuevo"]), "Informe-servicio-2026-09-24.pdf");
  });
});
