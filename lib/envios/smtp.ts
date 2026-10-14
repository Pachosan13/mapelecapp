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

export type ConfigCorreo = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  testTo: string | null;
};

export function leerConfigCorreo(): ConfigCorreo | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) return null;
  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    user,
    pass,
    fromName: process.env.MAIL_FROM_NAME?.trim() || "SEMCO",
    testTo: process.env.MAIL_TEST_TO?.trim() || null,
  };
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
