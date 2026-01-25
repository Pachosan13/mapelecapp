import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Database, Role } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function requireRole(allowedRoles: Role[]) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // profiles table uses user_id as the primary key
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !profile) {
    redirect("/unauthorized");
  }

  if (!allowedRoles.includes(profile.role)) {
    redirect("/unauthorized");
  }

  return { user, profile: profile as Profile };
}
