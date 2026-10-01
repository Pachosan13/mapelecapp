"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decidirCancelacion, limpiarMotivo } from "@/lib/visits/cancelar";

export type ReassignCrewResult = { error: string | null };
export type CancelVisitResult = { error: string | null };

/**
 * Reasigna una visita a otra cuadrilla.
 *
 * Existe porque el traspaso entre técnicos no tenía salida en la app: el drag&drop del
 * daily board solo mueve visitas `planned` y sin reclamar (DailyCrewBoard: status !== planned
 * y assigned_tech_user_id != null la rechazan), así que una visita ya iniciada quedaba
 * anclada a la cuadrilla que la empezó. El equipo de campo lo resolvía creando una visita
 * duplicada y rehaciendo el mantenimiento desde cero.
 *
 * Limpia `assigned_tech_user_id` a propósito: el gate de acceso del técnico es
 * "asignado a mí OR mi cuadrilla", y la lista de /tech/today solo muestra visitas de
 * cuadrilla cuando nadie las reclamó. Dejando el claim viejo, la cuadrilla nueva podría
 * abrir la visita por URL pero no la vería en su pantalla. Quién hizo el trabajo original
 * no se pierde: vive en `visit_responses.created_by` y en el historial de snapshots.
 *
 * Gated a ops_manager/director y ejecutado con el cliente admin, mismo patrón que createCrew.
 */
export async function reassignVisitCrew(
  visitId: string,
  crewId: string
): Promise<ReassignCrewResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ops_manager" && user.role !== "director")) {
    return { error: "No autorizado." };
  }
  if (!visitId || !crewId) {
    return { error: "Falta la visita o la cuadrilla." };
  }

  const admin = createAdminClient();

  const { data: visit, error: visitError } = await admin
    .from("visits")
    .select("id,status,assigned_crew_id")
    .eq("id", visitId)
    .maybeSingle();
  if (visitError) return { error: visitError.message };
  if (!visit) return { error: "La visita ya no existe." };

  if (visit.status === "completed") {
    return {
      error:
        "Esta visita ya está completada. Reasignarla no cambiaría el informe ya generado.",
    };
  }
  if (visit.assigned_crew_id === crewId) {
    return { error: "La visita ya está en esa cuadrilla." };
  }

  const { data: crew, error: crewError } = await admin
    .from("crews")
    .select("id,name")
    .eq("id", crewId)
    .maybeSingle();
  if (crewError) return { error: crewError.message };
  if (!crew) return { error: "Esa cuadrilla ya no existe." };

  const { error } = await admin
    .from("visits")
    .update({ assigned_crew_id: crewId, assigned_tech_user_id: null })
    .eq("id", visitId);
  if (error) return { error: error.message };

  revalidatePath(`/ops/visits/${visitId}`);
  revalidatePath("/ops/visits");
  revalidatePath("/ops/visitas-abiertas");
  revalidatePath("/ops/daily-board");
  revalidatePath("/tech/today");
  return { error: null };
}

/**
 * Cancela una visita que ya no se va a hacer (p. ej. sacaron al técnico a un correctivo).
 *
 * Sin esto la visita coordinada quedaba abierta y se acumulaba en las listas. No se borra: pasa a
 * `cancelled` con quién, cuándo y por qué, así queda en el historial del edificio y fuera de las
 * listas de trabajo (agenda, tablero, técnico, panel del director).
 *
 * Solo se cancela si nadie ha trabajado en ella (ver `decidirCancelacion`): planeada, o iniciada
 * sin una sola respuesta ni foto. El `update` repite la condición de estado para que, si el técnico
 * la completa justo en ese momento, no se pise.
 */
export async function cancelVisit(
  visitId: string,
  motivo?: string
): Promise<CancelVisitResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ops_manager" && user.role !== "director")) {
    return { error: "No autorizado." };
  }
  if (!visitId) return { error: "Falta la visita." };

  const admin = createAdminClient();

  const { data: visit, error: visitError } = await admin
    .from("visits")
    .select("id,status")
    .eq("id", visitId)
    .maybeSingle();
  if (visitError) return { error: visitError.message };
  if (!visit) return { error: "La visita ya no existe." };

  const [respuestas, fotos] = await Promise.all([
    admin.from("visit_responses").select("id", { count: "exact", head: true }).eq("visit_id", visitId),
    admin.from("media").select("id", { count: "exact", head: true }).eq("visit_id", visitId),
  ]);
  if (respuestas.error) return { error: respuestas.error.message };
  if (fotos.error) return { error: fotos.error.message };

  const decision = decidirCancelacion({
    status: visit.status,
    respuestas: respuestas.count ?? 0,
    fotos: fotos.count ?? 0,
  });
  if (!decision.ok) return { error: decision.motivo };

  const { data: updated, error } = await admin
    .from("visits")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      cancel_reason: limpiarMotivo(motivo),
    })
    .eq("id", visitId)
    .in("status", ["planned", "in_progress"])
    .select("id");
  if (error) return { error: error.message };
  if (!updated || updated.length === 0) {
    return { error: "La visita cambió mientras la cancelabas. Recarga la página." };
  }

  revalidatePath(`/ops/visits/${visitId}`);
  revalidatePath("/ops/visits");
  revalidatePath("/ops/visitas-abiertas");
  revalidatePath("/ops/daily-board");
  revalidatePath("/tech/today");
  revalidatePath("/dir/overview");
  return { error: null };
}
