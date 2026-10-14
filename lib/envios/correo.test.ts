import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aplicarDesvioDePrueba,
  asuntoInforme,
  cuerpoInforme,
  decidirEnvio,
  leerCorreos,
  limpiarNota,
  MAX_DESTINATARIOS,
} from "./correo.ts";

test("leerCorreos separa por coma, punto y coma, espacio y salto de línea", () => {
  const r = leerCorreos("a@x.com, B@X.com;c@y.pa\nd@z.com.pa  e@w.org");
  assert.deepEqual(r.validos, ["a@x.com", "b@x.com", "c@y.pa", "d@z.com.pa", "e@w.org"]);
  assert.deepEqual(r.invalidos, []);
});

test("leerCorreos quita repetidos sin importar mayúsculas", () => {
  assert.deepEqual(leerCorreos("a@x.com A@X.COM").validos, ["a@x.com"]);
});

test("leerCorreos devuelve los inválidos en vez de tirarlos", () => {
  const r = leerCorreos("bueno@x.com malo@ sinarroba.com");
  assert.deepEqual(r.validos, ["bueno@x.com"]);
  assert.deepEqual(r.invalidos, ["malo@", "sinarroba.com"]);
});

test("leerCorreos con vacío o null", () => {
  assert.deepEqual(leerCorreos(""), { validos: [], invalidos: [] });
  assert.deepEqual(leerCorreos(null), { validos: [], invalidos: [] });
});

test("decidirEnvio: solo visitas completadas", () => {
  for (const status of ["planned", "in_progress", "cancelled", null]) {
    const d = decidirEnvio({ status, destinatarios: ["a@x.com"], invalidos: [] });
    assert.equal(d.ok, false);
  }
  assert.deepEqual(decidirEnvio({ status: "completed", destinatarios: ["a@x.com"], invalidos: [] }), { ok: true });
});

test("decidirEnvio: rechaza si hay inválidos, si no hay destinatarios o si son demasiados", () => {
  const conInvalido = decidirEnvio({ status: "completed", destinatarios: ["a@x.com"], invalidos: ["malo@"] });
  assert.equal(conInvalido.ok, false);
  assert.match((conInvalido as { motivo: string }).motivo, /malo@/);
  assert.equal(decidirEnvio({ status: "completed", destinatarios: [], invalidos: [] }).ok, false);
  const muchos = Array.from({ length: MAX_DESTINATARIOS + 1 }, (_, i) => `c${i}@x.com`);
  assert.equal(decidirEnvio({ status: "completed", destinatarios: muchos, invalidos: [] }).ok, false);
});

test("limpiarNota recorta y vacía a null", () => {
  assert.equal(limpiarNota("   "), null);
  assert.equal(limpiarNota(undefined), null);
  assert.equal(limpiarNota("  hola "), "hola");
  assert.equal(limpiarNota("x".repeat(2000))!.length, 1000);
});

test("asuntoInforme", () => {
  assert.equal(
    asuntoInforme(" PH LUNA ", "martes, 14 de octubre de 2026"),
    "Informe de mantenimiento · PH LUNA · martes, 14 de octubre de 2026"
  );
});

test("cuerpoInforme escapa HTML y lleva la nota y la firma", () => {
  const { html, texto } = cuerpoInforme({
    edificio: "Torre <A>",
    fechaLarga: "14 de octubre",
    formularios: ["Red húmeda"],
    nota: "Línea 1\nLínea 2",
    firma: "William Rodriguez",
  });
  assert.match(html, /Torre &lt;A&gt;/);
  assert.match(html, /Línea 1<br>Línea 2/);
  assert.match(html, /William Rodriguez<br>SEMCO/);
  assert.match(texto, /\(Red húmeda\) realizado en Torre <A> el 14 de octubre/);
  assert.match(cuerpoInforme({ edificio: "X", fechaLarga: "hoy", formularios: [], nota: null, firma: "SEMCO" }).html, /Saludos,<br>SEMCO<\/p>$/);
  assert.doesNotMatch(cuerpoInforme({ edificio: "X", fechaLarga: "hoy", formularios: [], nota: null, firma: "W" }).html, /undefined|null/);
});

test("aplicarDesvioDePrueba: sin correo de prueba no cambia nada", () => {
  assert.deepEqual(aplicarDesvioDePrueba(["a@x.com"], "Asunto", ""), { para: ["a@x.com"], asunto: "Asunto" });
  assert.deepEqual(aplicarDesvioDePrueba(["a@x.com"], "Asunto", undefined), { para: ["a@x.com"], asunto: "Asunto" });
});

test("aplicarDesvioDePrueba: con correo de prueba manda todo ahí y avisa a quién iba", () => {
  const r = aplicarDesvioDePrueba(["a@x.com", "b@x.com"], "Asunto", "qa@level5.com");
  assert.deepEqual(r.para, ["qa@level5.com"]);
  assert.equal(r.asunto, "[PRUEBA → a@x.com, b@x.com] Asunto");
});
