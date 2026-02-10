"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function ensureProfileExists(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { error };
  }

  if (!data) {
    const profiles = (supabase as any).from("profiles");
    const { error: upsertError } = await profiles.upsert(
      {
        user_id: userId,
        full_name: null,
        role: "tech",
        is_active: false,
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      return { error: upsertError };
    }
  }

  return { error: null };
}

export async function loginWithPassword(email: string, password: string) {
  const supabase = await createClient();

  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !data.user) {
    return { error: signInError?.message ?? "Login failed" };
  }

  const { error: ensureError } = await ensureProfileExists(data.user.id);
  if (ensureError) {
    return { error: "No se pudo crear el perfil del usuario." };
  }

  return { error: null };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
