import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatChecklistValue, isNivelLabel, opcionesPozo } from "./checklistLabels.ts";

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

describe("casillas de la bomba de pozo (William, 17-nov-2026)", () => {
  const G = "Bomba de pozo 1 - ";
  const textos = (l: string) => opcionesPozo(l)?.map((o) => o.text);

  it("ofrece exactamente las opciones que dictó", () => {
    assert.deepEqual(textos(G + "Estado de la bomba"), ["Operativa", "No opera"]);
    assert.deepEqual(textos(G + "Alarmas del controlador"), ["Sin alarmas", "Con alarma"]);
    assert.deepEqual(textos(G + "Arranque automático por demanda de llenado"), [
      "Correcto",
      "Falla",
      "No verificado",
    ]);
  });

  it("el informe imprime las mismas palabras que marcó el técnico", () => {
    assert.equal(formatChecklistValue(true, null, G + "Estado de la bomba"), "Operativa");
    assert.equal(formatChecklistValue(false, null, G + "Estado de la bomba"), "No opera");
    assert.equal(formatChecklistValue(true, null, G + "Alarmas del controlador"), "Sin alarmas");
    assert.equal(formatChecklistValue(false, null, G + "Alarmas del controlador"), "Con alarma");
    const arranque = G + "Arranque automático por demanda de llenado";
    assert.equal(formatChecklistValue(true, null, arranque), "Correcto");
    assert.equal(formatChecklistValue(false, null, arranque), "Falla");
    assert.equal(formatChecklistValue(null, "na", arranque), "No verificado");
    assert.equal(formatChecklistValue(null, null, arranque), "—");
  });

  it("no le cambia el texto a otros sistemas", () => {
    assert.equal(opcionesPozo("Bomba de piscina 1 - Limpieza general"), null);
    assert.equal(opcionesPozo("Bombas principales - Bomba 1 - Estado de la bomba"), null);
    assert.equal(opcionesPozo(G + "Voltaje con la bomba en marcha (V)"), null);
    assert.equal(opcionesPozo(null), null);
  });
});
