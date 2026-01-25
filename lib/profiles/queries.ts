import { createClient } from "@/lib/supabase/server";
import type { Category, Role } from "@/types/database";

type ProfileListItem = {
  user_id: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  primary_category: Category | null;
  home_crew_id: string | null;
};

type ProfileDetail = ProfileListItem;

export async function getAllProfiles() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "user_id,full_name,role,is_active,created_at,updated_at,primary_category,home_crew_id"
    )
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  return {
    data: (data ?? []) as ProfileListItem[],
    error,
  };
}

export async function getProfileById(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "user_id,full_name,role,is_active,created_at,updated_at,primary_category,home_crew_id"
    )
    .eq("user_id", userId)
    .maybeSingle();

  return {
    data: (data ?? null) as ProfileDetail | null,
    error,
  };
}

export async function updateProfile(
  userId: string,
  data: {
    full_name?: string | null;
    role?: Role;
    is_active?: boolean;
    primary_category?: Category | null;
    home_crew_id?: string | null;
  }
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update(data)
    .eq("user_id", userId);

  return { error };
}
