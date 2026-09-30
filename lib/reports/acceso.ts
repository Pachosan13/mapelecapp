// Quién puede abrir el PDF de un informe, y con qué alcance.
//
// Decisión pura, separada de la ruta para poder probarla sin base de datos. La ruta
// `/api/reports/service-report` la usa ANTES de leer nada.
//
// - ops_manager y director: como siempre. Pueden pedir un informe por visita o por
//   edificio+fecha, y leen con sus propios permisos.
// - facturacion: SOLO LECTURA. Únicamente por `visitId`, y solo si esa visita ya está
//   completada. La ruta lo atiende con el cliente de administración (este rol no tiene
//   políticas de lectura en las tablas) y sin escribir nada: por eso el alcance se cierra acá.
// - tech y cualquier otra cosa: 403, igual que antes.

export type RolInforme = "tech" | "ops_manager" | "director" | "facturacion" | null;

export type DecisionInforme =
  | { ok: true; soloLectura: boolean; requiereVisitaCompletada: boolean }
  | { ok: false; status: 403; motivo: string };

export function decidirAccesoInforme(params: {
  role: RolInforme | string | undefined;
  visitId: string | null | undefined;
}): DecisionInforme {
  const { role, visitId } = params;

  if (role === "ops_manager" || role === "director") {
    return { ok: true, soloLectura: false, requiereVisitaCompletada: false };
  }

  if (role === "facturacion") {
    if (!visitId) {
      return {
        ok: false,
        status: 403,
        motivo: "Este rol solo puede abrir informes por visita.",
      };
    }
    return { ok: true, soloLectura: true, requiereVisitaCompletada: true };
  }

  return { ok: false, status: 403, motivo: "Forbidden" };
}

/** Un informe de facturación solo existe para visitas terminadas. */
export const visitaEsFacturable = (estado: string | null | undefined): boolean =>
  estado === "completed";
