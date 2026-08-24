import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esItemTipoInspeccion,
  frecuenciaDeItem,
  frecuenciasPresentes,
  itemAplicaAFrecuencia,
  parseFrecuencia,
  tieneBloquesPorFrecuencia,
} from "./frecuencia.ts";

// Muestra real del template "INSPECCIÓN PRUEBA Y MANTENIMIENTO DE SISTEMAS DE ROCIADORES
// NFPA25" (a74182b1) tal como está en prod: 76 ítems en 7 grupos.
const LABELS = [
  "Datos generales - Tipo de inspección",
  "Datos generales - Información de estacas",
  "Mensual - Válvulas de control: accesibles",
  "Mensual - Manómetros: operativo y no físicamente dañado",
  "Trimestral - Válvulas de manguera: sin fugas",
  "Semestral - Alarmas de flujo de agua: prueba de flujo",
  "Anual - Rociadores: fugas",
  "Cada 5 años - Manómetro: prueba con manómetro calibrado, 3% o reemplazo",
  "Cierre - Comentarios/Observaciones",
  "Cierre - Recibido por",
  "Cierre - Realizado por",
];

describe("frecuenciaDeItem", () => {
  it("lee la frecuencia del prefijo del grupo", () => {
    assert.equal(frecuenciaDeItem("Mensual - Válvulas de control: accesibles"), "Mensual");
    assert.equal(frecuenciaDeItem("Trimestral - Válvulas de manguera: sin fugas"), "Trimestral");
    assert.equal(
      frecuenciaDeItem("Cada 5 años - Manómetro: prueba con manómetro calibrado"),
      "Cada 5 años"
    );
  });

  it("devuelve null en los bloques administrativos", () => {
    assert.equal(frecuenciaDeItem("Datos generales - Tipo de inspección"), null);
    assert.equal(frecuenciaDeItem("Cierre - Recibido por"), null);
    assert.equal(frecuenciaDeItem("Recorrido por pisos"), null);
    assert.equal(frecuenciaDeItem(null), null);
  });

  it("sobrevive al anidado con ' · ' de un formulario unificado", () => {
    assert.equal(frecuenciaDeItem("Rociadores · Trimestral - Válvulas de manguera: sin fugas"), "Trimestral");
  });
});

describe("parseFrecuencia", () => {
  it("acepta la etiqueta exacta y variantes sin acento o en minúscula", () => {
    assert.equal(parseFrecuencia("Mensual"), "Mensual");
    assert.equal(parseFrecuencia("  anual "), "Anual");
    assert.equal(parseFrecuencia("cada 5 anos"), "Cada 5 años");
  });

  it("null en lo que no reconoce — incluido el 'Nfpa25' de las visitas viejas", () => {
    assert.equal(parseFrecuencia("Nfpa25"), null);
    assert.equal(parseFrecuencia(""), null);
    assert.equal(parseFrecuencia(null), null);
  });
});

describe("itemAplicaAFrecuencia", () => {
  it("sin frecuencia seleccionada no filtra nada", () => {
    for (const label of LABELS) {
      assert.equal(itemAplicaAFrecuencia(label, null), true);
    }
  });

  it("mensual deja los 12 del mes y esconde el resto de bloques", () => {
    const visibles = LABELS.filter((l) => itemAplicaAFrecuencia(l, "Mensual"));
    assert.deepEqual(visibles, [
      "Datos generales - Tipo de inspección",
      "Datos generales - Información de estacas",
      "Mensual - Válvulas de control: accesibles",
      "Mensual - Manómetros: operativo y no físicamente dañado",
      "Cierre - Comentarios/Observaciones",
      "Cierre - Recibido por",
      "Cierre - Realizado por",
    ]);
  });

  it("es acumulativo: la trimestral incluye la mensual (NFPA 25)", () => {
    assert.equal(itemAplicaAFrecuencia("Mensual - Manómetros: operativo", "Trimestral"), true);
    assert.equal(itemAplicaAFrecuencia("Trimestral - Válvulas de manguera: sin fugas", "Trimestral"), true);
    assert.equal(itemAplicaAFrecuencia("Semestral - Alarmas de flujo de agua: prueba de flujo", "Trimestral"), false);
  });

  it("la anual arrastra todo menos el bloque de 5 años", () => {
    const visibles = LABELS.filter((l) => itemAplicaAFrecuencia(l, "Anual"));
    assert.equal(visibles.includes("Cada 5 años - Manómetro: prueba con manómetro calibrado, 3% o reemplazo"), false);
    assert.equal(visibles.length, LABELS.length - 1);
  });

  it("la de 5 años muestra el formato completo", () => {
    assert.deepEqual(LABELS.filter((l) => itemAplicaAFrecuencia(l, "Cada 5 años")), LABELS);
  });

  it("los bloques administrativos NO se esconden nunca — ahí va la firma", () => {
    assert.equal(itemAplicaAFrecuencia("Cierre - Recibido por", "Mensual"), true);
    assert.equal(itemAplicaAFrecuencia("Datos generales - Tipo de inspección", "Mensual"), true);
  });
});

describe("tieneBloquesPorFrecuencia", () => {
  it("sí en rociadores", () => {
    assert.equal(tieneBloquesPorFrecuencia(LABELS), true);
  });

  it("no en un formato sin bloques por frecuencia (bombas)", () => {
    assert.equal(
      tieneBloquesPorFrecuencia([
        "Datos generales - Proyecto",
        "Bombas principales - Bomba 1 - Voltaje L1-L2",
        "Entrega - Recibido por",
      ]),
      false
    );
  });

  it("no cuando solo hay un bloque — un selector de una opción no sirve", () => {
    assert.equal(
      tieneBloquesPorFrecuencia([
        "Datos generales - Proyecto",
        "Mensual - Válvulas de control: accesibles",
      ]),
      false
    );
  });
});

describe("frecuenciasPresentes", () => {
  it("las devuelve en orden de periodicidad, no de aparición", () => {
    assert.deepEqual(frecuenciasPresentes(LABELS), [
      "Mensual",
      "Trimestral",
      "Semestral",
      "Anual",
      "Cada 5 años",
    ]);
  });
});

describe("esItemTipoInspeccion", () => {
  it("reconoce el campo con y sin prefijo de grupo", () => {
    assert.equal(esItemTipoInspeccion("Datos generales - Tipo de inspección"), true);
    assert.equal(esItemTipoInspeccion("Tipo de inspección"), true);
    assert.equal(esItemTipoInspeccion("Datos generales - Información de estacas"), false);
  });
});
