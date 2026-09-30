import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agruparPorDia,
  filtrarEdificio,
  opcionesEdificio,
  resumen,
  type FilaFacturable,
} from "./agrupar.ts";

const fila = (p: Partial<FilaFacturable> & { id: string }): FilaFacturable => ({
  completedAt: "2026-09-29T15:00:00.000Z",
  dia: "2026-09-29",
  edificioId: "e1",
  edificio: "P.H. VIVA PLAZA",
  formulario: "Mantenimiento – Bombas",
  responsable: null,
  archivo: "Informe-servicio.pdf",
  ...p,
});

describe("agruparPorDia", () => {
  it("un grupo por día, el más reciente primero", () => {
    const g = agruparPorDia([
      fila({ id: "a", dia: "2026-09-28" }),
      fila({ id: "b", dia: "2026-09-30" }),
      fila({ id: "c", dia: "2026-09-29" }),
    ]);
    assert.deepEqual(g.map((x) => x.dia), ["2026-09-30", "2026-09-29", "2026-09-28"]);
  });

  it("dentro del día va por edificio y luego formulario: los dos PDF de un mantenimiento quedan juntos", () => {
    const g = agruparPorDia([
      fila({ id: "1", edificioId: "b", edificio: "PH COSTANERA", formulario: "RED HÚMEDA CONTRA INCENDIOS" }),
      fila({ id: "2", edificioId: "a", edificio: "PH ALEXA", formulario: "Mantenimiento – Bombas" }),
      fila({ id: "3", edificioId: "b", edificio: "PH COSTANERA", formulario: "Mantenimiento – Bombas" }),
    ]);
    assert.deepEqual(g[0].filas.map((x) => x.id), ["2", "3", "1"]);
  });

  it("el orden alfabético ignora mayúsculas y acentos", () => {
    const g = agruparPorDia([
      fila({ id: "1", edificioId: "a", edificio: "Zeus" }),
      fila({ id: "2", edificioId: "b", edificio: "águila" }),
      fila({ id: "3", edificioId: "c", edificio: "BAHÍA" }),
    ]);
    assert.deepEqual(g[0].filas.map((x) => x.id), ["2", "3", "1"]);
  });

  it("sin filas no hay grupos", () => assert.deepEqual(agruparPorDia([]), []));

  it("no modifica el arreglo que recibe", () => {
    const entrada = [fila({ id: "2", edificio: "B" }), fila({ id: "1", edificio: "A" })];
    agruparPorDia(entrada);
    assert.deepEqual(entrada.map((x) => x.id), ["2", "1"]);
  });
});

describe("resumen / opciones / filtro", () => {
  const filas = [
    fila({ id: "1", edificioId: "a", edificio: "Zeus" }),
    fila({ id: "2", edificioId: "a", edificio: "Zeus", formulario: "RED HÚMEDA CONTRA INCENDIOS" }),
    fila({ id: "3", edificioId: "b", edificio: "Alexa" }),
  ];

  it("cuenta informes y edificios distintos", () => {
    assert.deepEqual(resumen(filas), { informes: 3, edificios: 2 });
  });

  it("las opciones de edificio salen sin repetir y en orden", () => {
    assert.deepEqual(opcionesEdificio(filas), [
      { id: "b", nombre: "Alexa" },
      { id: "a", nombre: "Zeus" },
    ]);
  });

  it("filtrar por edificio deja solo los suyos; sin edificio deja todo", () => {
    assert.deepEqual(filtrarEdificio(filas, "a").map((x) => x.id), ["1", "2"]);
    assert.equal(filtrarEdificio(filas, "").length, 3);
    assert.equal(filtrarEdificio(filas, null).length, 3);
  });

  it("un edificio que no existe no devuelve nada", () => {
    assert.equal(filtrarEdificio(filas, "zzz").length, 0);
  });
});
