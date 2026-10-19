import nodemailer from "nodemailer";

// Salida del correo por SMTP. SEMCO usa Google Workspace (MX aspmx.l.google.com), así que por
// defecto sale por smtp.gmail.com con la cuenta de William y una contraseña de aplicación:
// el correo queda en SU carpeta de Enviados y las respuestas del cliente le llegan a él.
// Si un día cambia el proveedor, se cambian las variables, no el código.
//
//   SMTP_USER, SMTP_PASS         → obligatorias (cuenta y contraseña de aplicación)
//   SMTP_HOST, SMTP_PORT         → opcionales (smtp.gmail.com, 465)
//   MAIL_FROM_NAME               → nombre visible del remitente (y firma del correo)
//   MAIL_TEST_TO                 → en preview/QA: todo correo se desvía aquí
//   SMTP_CUENTAS                 → opcional: cuentas propias por gerente (JSON)
//
// SMTP_CUENTAS existe porque cada gerente manda su área (William, 19-oct-2026: él manda
// bombas y José Pineda red húmeda, y las consultas del cliente le tienen que llegar a quien
// lo mandó). La llave es el correo con el que el gerente entra a la app:
//   {"jose.pineda@semco.com.pa": {"pass": "<contraseña de aplicación>", "nombre": "José Pineda · SEMCO"}}
// El gerente que no esté ahí sigue saliendo por SMTP_USER, como antes.

export type ConfigCorreo = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  testTo: string | null;
};

type Env = Record<string, string | undefined>;

function cuentaPropia(env: Env, correoUsuario: string | null | undefined) {
  const correo = correoUsuario?.trim().toLowerCase();
  const crudo = env.SMTP_CUENTAS?.trim();
  if (!correo || !crudo) return null;
  let cuentas: unknown;
  try {
    cuentas = JSON.parse(crudo);
  } catch {
    // Un JSON roto no puede tumbar el envío de todos: se sigue con la cuenta de siempre.
    console.error("[smtp] SMTP_CUENTAS no es JSON válido; se usa SMTP_USER");
    return null;
  }
  if (!cuentas || typeof cuentas !== "object") return null;
  for (const [llave, valor] of Object.entries(cuentas as Record<string, unknown>)) {
    if (llave.trim().toLowerCase() !== correo || !valor || typeof valor !== "object") continue;
    const { pass, nombre } = valor as { pass?: unknown; nombre?: unknown };
    if (typeof pass !== "string" || !pass.trim()) return null;
    return {
      user: llave.trim().toLowerCase(),
      pass: pass.trim(),
      nombre: typeof nombre === "string" && nombre.trim() ? nombre.trim() : null,
    };
  }
  return null;
}

/**
 * Cuenta por la que sale el correo del gerente `correoUsuario`: la suya si está en
 * SMTP_CUENTAS, si no la de SMTP_USER. `null` si no hay ninguna configurada.
 */
export function leerConfigCorreo(
  correoUsuario?: string | null,
  env: Env = process.env
): ConfigCorreo | null {
  const base = {
    host: env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(env.SMTP_PORT) || 465,
    testTo: env.MAIL_TEST_TO?.trim() || null,
  };
  const propia = cuentaPropia(env, correoUsuario);
  if (propia) {
    return { ...base, user: propia.user, pass: propia.pass, fromName: propia.nombre ?? "SEMCO" };
  }
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS?.trim();
  if (!user || !pass) return null;
  return { ...base, user, pass, fromName: env.MAIL_FROM_NAME?.trim() || "SEMCO" };
}

export async function enviarCorreo(
  config: ConfigCorreo,
  mensaje: {
    para: string[];
    asunto: string;
    html: string;
    texto: string;
    adjunto: { nombre: string; bytes: Uint8Array };
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const transporte = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  try {
    await transporte.sendMail({
      from: { name: config.fromName, address: config.user },
      to: mensaje.para,
      subject: mensaje.asunto,
      html: mensaje.html,
      text: mensaje.texto,
      attachments: [
        {
          filename: mensaje.adjunto.nombre,
          content: Buffer.from(mensaje.adjunto.bytes),
          contentType: "application/pdf",
        },
      ],
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? String(e) };
  } finally {
    transporte.close();
  }
}
