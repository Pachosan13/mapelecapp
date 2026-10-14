// Envío del informe al cliente por correo: reglas puras (sin red ni base), para probarlas solas.
//
// Pedido de William (30-sep y 14-oct-2026): que el informe salga de su correo, con un clic
// suyo después de revisarlo. Aquí vive qué correos son válidos, el asunto y el cuerpo.

export const MAX_DESTINATARIOS = 10;
export const NOTA_MAX = 1000;

const EMAIL_RE = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}$/;

/**
 * Lee una lista de correos escrita a mano: separados por coma, punto y coma, espacio o salto
 * de línea. Devuelve los válidos (en minúscula, sin repetidos y en el orden escrito) y los que
 * no parecen correo, para mostrárselos al usuario en vez de descartarlos callado.
 */
export function leerCorreos(texto: string | null | undefined): {
  validos: string[];
  invalidos: string[];
} {
  const validos: string[] = [];
  const invalidos: string[] = [];
  const partes = (texto ?? "").split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
  for (const parte of partes) {
    const correo = parte.toLowerCase();
    if (!EMAIL_RE.test(correo)) {
      invalidos.push(parte);
      continue;
    }
    if (!validos.includes(correo)) validos.push(correo);
  }
  return { validos, invalidos };
}

export type DecisionEnvio = { ok: true } | { ok: false; motivo: string };

export function decidirEnvio(params: {
  status: string | null | undefined;
  destinatarios: string[];
  invalidos: string[];
}): DecisionEnvio {
  const { status, destinatarios, invalidos } = params;
  if (status !== "completed") {
    return { ok: false, motivo: "Solo se puede enviar el informe de una visita completada." };
  }
  if (invalidos.length > 0) {
    return {
      ok: false,
      motivo: `Revisa ${invalidos.length === 1 ? "este correo" : "estos correos"}: ${invalidos.join(", ")}`,
    };
  }
  if (destinatarios.length === 0) {
    return { ok: false, motivo: "Escribe al menos un correo del cliente." };
  }
  if (destinatarios.length > MAX_DESTINATARIOS) {
    return { ok: false, motivo: `Máximo ${MAX_DESTINATARIOS} correos por envío.` };
  }
  return { ok: true };
}

export function limpiarNota(nota: string | null | undefined): string | null {
  const limpia = (nota ?? "").trim().slice(0, NOTA_MAX);
  return limpia || null;
}

export function asuntoInforme(edificio: string, fechaLarga: string): string {
  return `Informe de mantenimiento · ${edificio.trim()} · ${fechaLarga}`;
}

const escapar = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Cuerpo del correo en HTML y en texto plano (el texto es para clientes de correo viejos). */
export function cuerpoInforme(params: {
  edificio: string;
  fechaLarga: string;
  formularios: string[];
  nota: string | null;
  firma: string;
}): { html: string; texto: string } {
  const { edificio, fechaLarga, formularios, nota, firma } = params;
  const servicio = formularios.length > 0 ? ` (${formularios.join(", ")})` : "";
  const parrafos = [
    "Buen día,",
    `Adjuntamos el informe del mantenimiento${servicio} realizado en ${edificio.trim()} el ${fechaLarga}.`,
    ...(nota ? [nota] : []),
    "Cualquier consulta, con gusto la atendemos respondiendo este correo.",
  ];
  // Si la firma ya es "SEMCO" no se repite la empresa debajo.
  const lineasFirma = firma.trim().toUpperCase() === "SEMCO" ? ["SEMCO"] : [firma.trim(), "SEMCO"];
  const html =
    parrafos.map((p) => `<p>${escapar(p).replace(/\n/g, "<br>")}</p>`).join("") +
    `<p>Saludos,<br>${lineasFirma.map(escapar).join("<br>")}</p>`;
  const texto = [...parrafos, ["Saludos,", ...lineasFirma].join("\n")].join("\n\n");
  return { html, texto };
}

/**
 * En pruebas (preview, QA) todo correo se desvía a `MAIL_TEST_TO`, para que un ensayo nunca
 * le llegue a un cliente real. El asunto dice a quién iba.
 */
export function aplicarDesvioDePrueba(
  destinatarios: string[],
  asunto: string,
  correoDePrueba: string | null | undefined
): { para: string[]; asunto: string } {
  const prueba = (correoDePrueba ?? "").trim();
  if (!prueba) return { para: destinatarios, asunto };
  return { para: [prueba], asunto: `[PRUEBA → ${destinatarios.join(", ")}] ${asunto}` };
}
