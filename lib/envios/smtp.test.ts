import { test } from "node:test";
import assert from "node:assert/strict";
import { leerConfigCorreo } from "./smtp.ts";

const WILLIAM = {
  SMTP_USER: "william.rodriguez@semco.com.pa",
  SMTP_PASS: "clave-william",
  MAIL_FROM_NAME: "William Rodríguez · SEMCO",
};
const CUENTAS = JSON.stringify({
  "Jose.Pineda@semco.com.pa": { pass: "clave-pineda", nombre: "José Pineda · SEMCO" },
});

test("sin nada configurado no hay envío", () => {
  assert.equal(leerConfigCorreo("william.rodriguez@semco.com.pa", {}), null);
});

test("el gerente sin cuenta propia sale por la de siempre (William)", () => {
  const c = leerConfigCorreo("guillermo.ulloa@semco.com.pa", { ...WILLIAM, SMTP_CUENTAS: CUENTAS });
  assert.equal(c?.user, "william.rodriguez@semco.com.pa");
  assert.equal(c?.pass, "clave-william");
  assert.equal(c?.fromName, "William Rodríguez · SEMCO");
});

test("sin SMTP_CUENTAS todo sigue igual que antes", () => {
  const c = leerConfigCorreo("jose.pineda@semco.com.pa", WILLIAM);
  assert.equal(c?.user, "william.rodriguez@semco.com.pa");
});

test("el gerente con cuenta propia sale por la suya, sin importar mayúsculas", () => {
  const c = leerConfigCorreo("jose.pineda@SEMCO.com.pa", { ...WILLIAM, SMTP_CUENTAS: CUENTAS });
  assert.equal(c?.user, "jose.pineda@semco.com.pa");
  assert.equal(c?.pass, "clave-pineda");
  assert.equal(c?.fromName, "José Pineda · SEMCO");
});

test("la cuenta propia funciona aunque no haya cuenta general", () => {
  const c = leerConfigCorreo("jose.pineda@semco.com.pa", { SMTP_CUENTAS: CUENTAS });
  assert.equal(c?.user, "jose.pineda@semco.com.pa");
  assert.equal(leerConfigCorreo("william.rodriguez@semco.com.pa", { SMTP_CUENTAS: CUENTAS }), null);
});

test("host, puerto y desvío de prueba valen también para la cuenta propia", () => {
  const c = leerConfigCorreo("jose.pineda@semco.com.pa", {
    ...WILLIAM,
    SMTP_CUENTAS: CUENTAS,
    SMTP_PORT: "587",
    MAIL_TEST_TO: "qa@x.com",
  });
  assert.equal(c?.host, "smtp.gmail.com");
  assert.equal(c?.port, 587);
  assert.equal(c?.testTo, "qa@x.com");
});

test("cuenta propia sin nombre firma «SEMCO»", () => {
  const cuentas = JSON.stringify({ "jose.pineda@semco.com.pa": { pass: "x" } });
  assert.equal(leerConfigCorreo("jose.pineda@semco.com.pa", { SMTP_CUENTAS: cuentas })?.fromName, "SEMCO");
});

test("JSON roto o cuenta sin clave no tumban el envío: cae a William", () => {
  for (const crudo of ["{no es json", "[]", '"texto"', JSON.stringify({ "jose.pineda@semco.com.pa": { pass: " " } })]) {
    const c = leerConfigCorreo("jose.pineda@semco.com.pa", { ...WILLIAM, SMTP_CUENTAS: crudo });
    assert.equal(c?.user, "william.rodriguez@semco.com.pa", crudo);
  }
});

test("sin correo de usuario sale por la de siempre", () => {
  assert.equal(leerConfigCorreo(null, { ...WILLIAM, SMTP_CUENTAS: CUENTAS })?.user, "william.rodriguez@semco.com.pa");
  assert.equal(leerConfigCorreo(undefined, { ...WILLIAM, SMTP_CUENTAS: CUENTAS })?.user, "william.rodriguez@semco.com.pa");
});
