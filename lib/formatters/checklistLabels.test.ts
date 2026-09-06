import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatChecklistValue, isNivelLabel } from "./checklistLabels.ts";

const P = "Sistema de bombas diésel";

describe("etiquetas de casillas del checklist", () => {
  it("reconoce los cuatro niveles que pidió William", () => {
    for (const l of [
      `${P} - El nivel de aceite del cárter está dentro del rango aceptable`,
      `${P} - El nivel de agua de refrigeración está dentro del rango aceptable`,
      `${P} - El nivel de electrolitos de las baterías está dentro del rango aceptable`,
      `${P} - El tanque de combustible está por lo menos 2/3 lleno`,
      "Bomba 1 - Nivel de aceite ok",
      "Bomba 1 - Combustible ok",
    ]) {
      assert.equal(isNivelLabel(l), true, l);
    }
  });

  it("NO toca las casillas vecinas del mismo grupo", () => {
    for (const l of [
      `${P} - Las lecturas del voltaje de las baterías (2) están dentro del rango aceptable`,
      `${P} - El interruptor del selector del controlador está en posición automática`,
    ]) {
      assert.equal(isNivelLabel(l), false, l);
    }
  });

  it("un nivel se lee Buen nivel / Bajo nivel, no Sí / No", () => {
    const l = `${P} - El nivel de aceite del cárter está dentro del rango aceptable`;
    assert.equal(formatChecklistValue(true, null, l), "Buen nivel");
    assert.equal(formatChecklistValue(false, null, l), "Bajo nivel");
    assert.equal(formatChecklistValue(null, "na", l), "N/A");
  });

  it("las casillas normales siguen igual", () => {
    const l = `${P} - Las lecturas del voltaje de las baterías (2) están dentro del rango aceptable`;
    assert.equal(formatChecklistValue(true, null, l), "Sí");
    assert.equal(formatChecklistValue(false, null, l), "No");
    assert.equal(formatChecklistValue(null, null, l), "—");
  });

  it("foso y panel conservan sus etiquetas propias", () => {
    assert.equal(formatChecklistValue(false, null, "Pluvial 1 - Estado del foso"), "Requiere limpieza");
    const panel = "Panel jockey - Estado general del panel";
    assert.equal(formatChecklistValue(true, null, panel), "Bueno");
    assert.equal(formatChecklistValue(false, null, panel), "Malo");
    // "Regular" ES el estado na: no se puede leer como N/A.
    assert.equal(formatChecklistValue(null, "na", panel), "Regular");
  });
});
