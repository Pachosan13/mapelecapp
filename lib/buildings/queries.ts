import { createClient } from "@/lib/supabase/server";
import type { Building } from "@/types/database";

type BuildingListItem = Pick<Building, "id" | "name" | "address" | "created_at">;
type BuildingDetail = Pick<
  Building,
  "id" | "name" | "address" | "notes" | "created_at"
>;

export async function listBuildings(query?: string) {
  const supabase = await createClient();

  let request = supabase
    .from("buildings")
    .select("id,name,address,created_at")
    .order("created_at", { ascending: false });

  if (query) {
    const sanitizedQuery = query.trim();
    if (sanitizedQuery) {
      request = request.or(
        `name.ilike.%${sanitizedQuery}%,address.ilike.%${sanitizedQuery}%`
      );
    }
  }

  const { data, error } = await request;

  return {
    data: (data ?? []) as BuildingListItem[],
    error,
  };
}

export async function getBuildingById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("buildings")
    .select("id,name,address,notes,created_at")
    .eq("id", id)
    .maybeSingle();

  return {
    data: data as BuildingDetail | null,
    error,
  };
}
