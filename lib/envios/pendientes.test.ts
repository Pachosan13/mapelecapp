import { test } from "node:test";
import assert from "node:assert/strict";
import { contarPendientes, estadoPorVisita, inicioDeLista } from "./pendientes.ts";
import { esFechaValida, sumarDias } from "../fact/rango.ts";

test("sin envíos no hay estado (la página lo trata como sin_enviar)", () => {
  assert.equal(estadoPorVisita([]).size, 0);
});

test("un envío exitoso cuenta como enviado aunque después falle un reenvío", () => {
  const m = estadoPorVisita([
    { visit_id: "v1", status: "sent", created_at: "2026-10-14T10:00:00Z" },
    { visit_id: "v1", status: "failed", created_at: "2026-10-14T11:00:00Z" },
  ]);
  assert.deepEqual(m.get("v1"), { estado: "enviado", ultimo: "2026-10-14T10:00:00Z" });
});

test("si primero falla y después sale, queda enviado con la fecha del exitoso", () => {
  const m = estadoPorVisita([
    { visit_id: "v1", status: "failed", created_at: "2026-10-14T09:00:00Z" },
    { visit_id: "v1", status: "sent", created_at: "2026-10-14T09:05:00Z" },
  ]);
  assert.deepEqual(m.get("v1"), { estado: "enviado", ultimo: "2026-10-14T09:05:00Z" });
});

test("solo fallos = fallo, con la fecha del último intento, sin importar el orden de llegada", () => {
  const m = estadoPorVisita([
    { visit_id: "v1", status: "failed", created_at: "2026-10-14T12:00:00Z" },
    { visit_id: "v1", status: "failed", created_at: "2026-10-14T09:00:00Z" },
  ]);
  assert.deepEqual(m.get("v1"), { estado: "fallo", ultimo: "2026-10-14T12:00:00Z" });
});

test("varios envíos exitosos: se queda con el más reciente", () => {
  const m = estadoPorVisita([
    { visit_id: "v1", status: "sent", created_at: "2026-10-15T09:00:00Z" },
    { visit_id: "v1", status: "sent", created_at: "2026-10-14T09:00:00Z" },
  ]);
  assert.deepEqual(m.get("v1"), { estado: "enviado", ultimo: "2026-10-15T09:00:00Z" });
});

test("contarPendientes: sin envío y con solo fallos cuentan; enviados no", () => {
  const m = estadoPorVisita([
    { visit_id: "v1", status: "sent", created_at: "2026-10-14T10:00:00Z" },
    { visit_id: "v2", status: "failed", created_at: "2026-10-14T10:00:00Z" },
  ]);
  assert.equal(contarPendientes(["v1", "v2", "v3"], m), 2);
});

test("inicioDeLista: sin ENVIOS_DESDE usa la ventana completa", () => {
  assert.deepEqual(inicioDeLista("2026-10-14", 30, undefined, esFechaValida, sumarDias), { desde: "2026-09-15", recortado: false });
  assert.deepEqual(inicioDeLista("2026-10-14", 30, "basura", esFechaValida, sumarDias), { desde: "2026-09-15", recortado: false });
});

test("inicioDeLista: el día de estreno recorta la ventana", () => {
  assert.deepEqual(inicioDeLista("2026-10-20", 30, "2026-10-14", esFechaValida, sumarDias), { desde: "2026-10-14", recortado: true });
});

test("inicioDeLista: si el estreno es más viejo que la ventana, manda la ventana", () => {
  assert.deepEqual(inicioDeLista("2026-12-31", 7, "2026-10-14", esFechaValida, sumarDias), { desde: "2026-12-25", recortado: false });
});

test("inicioDeLista: un estreno en el futuro no deja un rango al revés", () => {
  assert.deepEqual(inicioDeLista("2026-10-14", 7, "2026-10-20", esFechaValida, sumarDias), { desde: "2026-10-14", recortado: true });
});
