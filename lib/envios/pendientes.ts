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
