import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) =>
          cookieStore.set({ name, value, ...options }),
        remove: (name, options) =>
          cookieStore.set({ name, value: "", ...options }),
      },
    }
  );
}

export interface CurrentUser {
  id: string;
  email?: string;
  full_name?: string | null;
  role: "tech" | "ops_manager" | "director" | null;
  home_crew_id?: string | null;
}

async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,full_name,home_crew_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.log("[getCurrentUser] uid", user.id, "email", user.email);
    console.log(
      "[getCurrentUser] profileError",
      profileError?.code,
      profileError?.message
    );
    return {
      id: user.id,
      email: user.email,
      full_name: null,
      role: null,
    };
  }

  return {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name ?? null,
    role: profile?.role ?? null,
    home_crew_id: profile?.home_crew_id ?? null,
  };
}

export { getCurrentUser };
