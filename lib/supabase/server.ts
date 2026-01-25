import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

export interface CurrentUser {
  id: string;
  email?: string;
  role: "tech" | "ops_manager" | "director" | null;
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
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.log("[getCurrentUser] profile query error:", profileError.message);
    console.log("[getCurrentUser] error code:", profileError.code);
    console.log("[getCurrentUser] error details:", profileError.details);
    console.log("[getCurrentUser] error hint:", profileError.hint);
    console.log("[getCurrentUser] profile missing or blocked by RLS for user:", user.id);
    // Profile might not exist yet, return user without profile
    return {
      id: user.id,
      email: user.email,
      role: null,
    };
  }

  if (!profile) {
    console.log("[getCurrentUser] profile query returned no data (null) for user:", user.id);
    console.log("[getCurrentUser] profile missing for user:", user.id);
  }

  const safeProfile = profile as Profile | null;

  return {
    id: user.id,
    email: user.email,
    role: safeProfile?.role ?? null,
  };
}

export { createClient, getCurrentUser };
