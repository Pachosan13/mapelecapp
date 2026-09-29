import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyRow,
  generarFilasPorDefecto,
  mergeRows,
  rowHasData,
  type RecorridoRowDraft,
} from "./recorridoMerge.ts";

/** Fila "vacía" tal como la genera la tabla: solo el piso correlativo. */
const filaDefault = (index: number): RecorridoRowDraft => ({
  ...emptyRow(),
  piso: String(index + 1),
});

/** Fila llena como la deja el técnico en campo. */
const filaLlena = (piso: string, presion: string): RecorridoRowDraft => ({
  ...emptyRow(),
  piso,
  presion_entrada: presion,
  estacion_control_abierta: true,
  estado_manometro: true,
  gabinetes_manguera: true,
  extintores: true,
});

const rows = (n: number, fn: (i: number) => RecorridoRowDraft) =>
  Array.from({ length: n }, (_, i) => fn(i));

describe("rowHasData", () => {
  it("el piso correlativo NO es dato; uno distinto SÍ", () => {
    assert.equal(rowHasData(filaDefault(0), 0), false);
    assert.equal(rowHasData(filaDefault(69), 69), false);
    // El técnico de MATISSE numeró al revés: en la fila 0 escribió "53".
    assert.equal(rowHasData({ ...emptyRow(), piso: "53" }, 0), true);
  });

  it("una presión sola ya cuenta, y un check solo también", () => {
    assert.equal(rowHasData({ ...emptyRow(), presion_entrada: "60" }, 0), true);
    assert.equal(rowHasData({ ...emptyRow(), extintores: true }, 0), true);
    assert.equal(rowHasData({ ...emptyRow(), observacion: "fuga" }, 0), true);
  });
});

describe("mergeRows", () => {
  it("EL BUG DE MATISSE: 70 filas en blanco no pisan 56 pisos llenos", () => {
    // Lo que el técnico tiene guardado en su equipo.
    const local = rows(70, (i) =>
      i < 56 ? filaLlena(String(53 - i), String(60 + i)) : filaDefault(i)
    );
    // Lo que trae el HTML viejo que sirvió el service worker: todo en blanco.
    const server = rows(70, filaDefault);

    const merged = mergeRows(server, local);

    assert.equal(merged.length, 70);
    assert.equal(merged.filter((r, i) => rowHasData(r, i)).length, 56);
    assert.equal(merged[0].piso, "53");
    assert.equal(merged[0].presion_entrada, "60");
  });

  it("al revés también: server con datos y local en blanco no pierde nada", () => {
    const server = rows(70, (i) =>
      i < 10 ? filaLlena(String(i + 1), "45") : filaDefault(i)
    );
    const local = rows(70, filaDefault);

    const merged = mergeRows(server, local);

    assert.equal(merged.filter((r, i) => rowHasData(r, i)).length, 10);
    assert.equal(merged[0].presion_entrada, "45");
  });

  it("cuando las dos tienen datos gana la local (la más nueva de este equipo)", () => {
    const merged = mergeRows([filaLlena("1", "45")], [filaLlena("1", "99")]);

    assert.equal(merged[0].presion_entrada, "99");
  });

  it("conserva filas que solo existen de un lado (el técnico agregó pisos)", () => {
    const server = rows(70, filaDefault);
    const local = [...rows(70, filaDefault), filaLlena("71", "30")];

    const merged = mergeRows(server, local);

    assert.equal(merged.length, 71);
    assert.equal(merged[70].presion_entrada, "30");
  });

  it("dos vacíos siguen vacíos: la fusión no inventa datos", () => {
    const merged = mergeRows(rows(3, filaDefault), rows(3, filaDefault));

    assert.equal(merged.length, 3);
    assert.equal(
      merged.every((r, i) => !rowHasData(r, i)),
      true
    );
  });
});

describe("filas por defecto de MAYOR a MENOR (William, 29-sep-2026)", () => {
  it("14 pisos: arriba el 14, abajo el 1", () => {
    const filas = generarFilasPorDefecto(14);
    assert.equal(filas.length, 14);
    assert.equal(filas[0].piso, "14");
    assert.equal(filas[13].piso, "1");
  });

  it("el correlativo descendente NO es dato, ni el ascendente de antes", () => {
    const desc = generarFilasPorDefecto(14);
    assert.ok(desc.every((r, i) => !rowHasData(r, i, desc.length)));
    const asc = rows(14, filaDefault);
    assert.ok(asc.every((r, i) => !rowHasData(r, i, asc.length)));
  });

  it("un piso con nombre propio (PB, S1, E2) sí es dato", () => {
    assert.equal(rowHasData({ ...emptyRow(), piso: "S1" }, 13, 14), true);
    assert.equal(rowHasData({ ...emptyRow(), piso: "PB" }, 12, 14), true);
  });

  it("merge: filas por defecto locales NO tapan las llenas del server", () => {
    const server = generarFilasPorDefecto(6).map((f, i) =>
      i === 2 ? filaLlena(f.piso, "70") : f
    );
    const local = generarFilasPorDefecto(6);
    const merged = mergeRows(server, local);
    assert.equal(merged[2].presion_entrada, "70");
    assert.equal(merged.filter((r, i) => rowHasData(r, i, merged.length)).length, 1);
  });

  it("merge: agregar S1 al final (7ª fila local) se conserva", () => {
    const server = generarFilasPorDefecto(6);
    const local = [...server, { ...emptyRow(), piso: "S1", presion_entrada: "80" }];
    const merged = mergeRows(server, local);
    assert.equal(merged.length, 7);
    assert.equal(merged[6].piso, "S1");
  });
});
