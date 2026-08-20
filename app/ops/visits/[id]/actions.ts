"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReassignCrewResult = { error: string | null };

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
