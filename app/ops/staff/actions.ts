"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type CreateCrewInput = {
  name: string;
  category: "pump" | "fire";
};

export type CreateCrewResult = { error: string | null };

/**
 * Crea una cuadrilla. Gated server-side a ops_manager/director; el INSERT usa el cliente
 * admin (service role) porque `crews` no tiene policy RLS de INSERT. El nombre se valida
 * y se evita duplicado (case-insensitive) para no llenar el dropdown de cuadrillas repetidas.
 */
export async function createCrew(
  input: CreateCrewInput
): Promise<CreateCrewResult> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ops_manager" && user.role !== "director")) {
    return { error: "No autorizado." };
  }

  const name = input.name?.trim() ?? "";
  if (name.length < 2) {
    return { error: "El nombre de la cuadrilla es muy corto." };
  }
  if (input.category !== "pump" && input.category !== "fire") {
    return { error: "Categoría inválida." };
  }

  const admin = createAdminClient();

  const { data: existing, error: dupError } = await admin
    .from("crews")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (dupError) {
    return { error: dupError.message };
  }
  if (existing) {
    return { error: `Ya existe una cuadrilla llamada "${name}".` };
  }

  const { error } = await admin
    .from("crews")
    .insert({ name, category: input.category });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/ops/staff");
  revalidatePath("/ops/visits/new");
  revalidatePath("/ops/daily-board");
  return { error: null };
}
