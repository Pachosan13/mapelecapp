// Qué informes ya se le mandaron al cliente y cuáles no (pedido de William, 14-oct-2026: los
// de red húmeda se quedaban sin enviar). Pura, para probarla sin base.

export type EstadoEnvio = "enviado" | "fallo" | "sin_enviar";

export type EnvioRegistrado = {
  visit_id: string;
  status: string;
  created_at: string;
};

/**
 * Estado de envío por visita. Basta UN envío exitoso para que cuente como enviado, aunque
 * después haya fallado un reenvío. Si solo hubo fallos, es "fallo". Si nada, "sin_enviar".
 * `ultimo` es la fecha del último envío exitoso (o del último intento, si todos fallaron).
 */
export function estadoPorVisita(
  envios: EnvioRegistrado[]
): Map<string, { estado: EstadoEnvio; ultimo: string }> {
  const out = new Map<string, { estado: EstadoEnvio; ultimo: string }>();
  for (const e of envios) {
    const previo = out.get(e.visit_id);
    const ok = e.status === "sent";
    if (!previo) {
      out.set(e.visit_id, { estado: ok ? "enviado" : "fallo", ultimo: e.created_at });
      continue;
    }
    if (ok && previo.estado !== "enviado") {
      out.set(e.visit_id, { estado: "enviado", ultimo: e.created_at });
    } else if (ok === (previo.estado === "enviado") && e.created_at > previo.ultimo) {
      out.set(e.visit_id, { estado: previo.estado, ultimo: e.created_at });
    }
  }
  return out;
}

export function contarPendientes(
  visitIds: string[],
  estados: Map<string, { estado: EstadoEnvio }>
): number {
  return visitIds.filter((id) => (estados.get(id)?.estado ?? "sin_enviar") !== "enviado").length;
}

/**
 * Desde qué día cuenta la lista de envíos. Pacho (14-oct-2026): «que arranque desde el día que
 * se publique», para no mostrar como pendientes los informes que William ya mandó a mano antes
 * de que existiera el botón. Ese día vive en la variable ENVIOS_DESDE (AAAA-MM-DD); si falta o
 * no es una fecha válida, no hay corte. Las funciones de fecha llegan por parámetro para que este
 * archivo siga sin imports y se pruebe solo, como el resto de lib/envios.
 */
export function inicioDeLista(
  hoy: string,
  dias: number,
  envioDesde: string | null | undefined,
  esFechaValida: (v: string | null | undefined) => v is string,
  sumarDias: (fecha: string, dias: number) => string
): { desde: string; recortado: boolean } {
  const ventana = sumarDias(hoy, -(dias - 1));
  if (!esFechaValida(envioDesde) || envioDesde <= ventana) return { desde: ventana, recortado: false };
  return { desde: envioDesde > hoy ? hoy : envioDesde, recortado: true };
}
