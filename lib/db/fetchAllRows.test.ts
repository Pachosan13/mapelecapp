import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchAllRows } from "./fetchAllRows.ts";

describe("fetchAllRows", () => {
  const pagina = (filas: number[], desde: number, hasta: number) =>
    Promise.resolve({ data: filas.slice(desde, hasta + 1), error: null });

  it("trae TODO cuando hay más de 1000 filas (el caso que rompió la plantilla)", async () => {
    const todas = Array.from({ length: 1211 }, (_, i) => i);
    const llamadas: Array<[number, number]> = [];
    const { data } = await fetchAllRows<number>((d, h) => {
      llamadas.push([d, h]);
      return pagina(todas, d, h);
    });
    assert.equal(data.length, 1211);
    assert.equal(data[1210], 1210); // la última fila, la que se perdía
    assert.deepEqual(llamadas, [[0, 999], [1000, 1999]]);
  });

  it("con menos de una página no pide una segunda", async () => {
    const llamadas: number[] = [];
    const { data } = await fetchAllRows<number>((d, h) => {
      llamadas.push(d);
      return pagina([1, 2, 3], d, h);
    });
    assert.equal(data.length, 3);
    assert.equal(llamadas.length, 1);
  });

  it("con exactamente 1000 pide una segunda y para", async () => {
    const todas = Array.from({ length: 1000 }, (_, i) => i);
    const llamadas: number[] = [];
    const { data } = await fetchAllRows<number>((d, h) => {
      llamadas.push(d);
      return pagina(todas, d, h);
    });
    assert.equal(data.length, 1000);
    assert.equal(llamadas.length, 2);
  });

  it("si una página falla devuelve el error y lo traído hasta ahí", async () => {
    const { data, error } = await fetchAllRows<number>((d) =>
      d === 0
        ? Promise.resolve({ data: Array.from({ length: 1000 }, (_, i) => i), error: null })
        : Promise.resolve({ data: null, error: { message: "boom" } })
    );
    assert.equal(data.length, 1000);
    assert.deepEqual(error, { message: "boom" });
  });

  it("data null se trata como página vacía, no revienta", async () => {
    const { data, error } = await fetchAllRows<number>(() =>
      Promise.resolve({ data: null, error: null })
    );
    assert.deepEqual(data, []);
    assert.equal(error, null);
  });
});
