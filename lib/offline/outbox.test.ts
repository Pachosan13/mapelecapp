import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

/**
 * El outbox vive en `localStorage`. Acá se le pone uno de mentira ANTES de
 * importar el módulo, que es lo único que necesita para correr fuera del
 * navegador.
 */
const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

const { enqueue, pending, pendingCount, resolve } = await import("./outbox.ts");

const VISIT = "visita-1";

describe("outbox", () => {
  beforeEach(() => store.clear());

  it("dedupea por campo: la última edición reemplaza a la anterior", () => {
    enqueue(VISIT, { kind: "response", itemId: "a", valueNumber: 1 });
    enqueue(VISIT, { kind: "response", itemId: "a", valueNumber: 2 });

    const cola = pending(VISIT);
    assert.equal(cola.length, 1);
    assert.equal(
      cola[0].payload.kind === "response" ? cola[0].payload.valueNumber : null,
      2
    );
  });

  it("separa por visita", () => {
    enqueue(VISIT, { kind: "response", itemId: "a", valueNumber: 1 });
    enqueue("visita-2", { kind: "response", itemId: "a", valueNumber: 9 });

    assert.equal(pendingCount(VISIT), 1);
    assert.equal(pendingCount(), 2);
  });

  it("resolve saca la entrada cuando el server la aceptó", () => {
    const entry = enqueue(VISIT, { kind: "notes", notes: "hola" });

    resolve(entry.key, entry.ts);

    assert.equal(pendingCount(VISIT), 0);
  });

  it("LA CARRERA: no borra una edición hecha mientras la subida iba en vuelo", () => {
    // El drenador toma la entrada v1 y arranca el envío…
    const v1 = enqueue(VISIT, { kind: "response", itemId: "a", valueNumber: 1 });
    // …y mientras viaja, el técnico corrige el mismo campo.
    enqueue(VISIT, { kind: "response", itemId: "a", valueNumber: 2 });

    // Llega el ok del server, pero es el de v1.
    resolve(v1.key, v1.ts);

    const cola = pending(VISIT);
    assert.equal(cola.length, 1, "la corrección tiene que seguir en la cola");
    assert.equal(
      cola[0].payload.kind === "response" ? cola[0].payload.valueNumber : null,
      2
    );
  });

  it("sin ts se comporta como antes (borra igual)", () => {
    const entry = enqueue(VISIT, { kind: "response", itemId: "a", valueNumber: 1 });

    resolve(entry.key);

    assert.equal(pendingCount(VISIT), 0);
  });
});
