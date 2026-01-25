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
  full_name?: string | null;
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
    .select("role,full_name")
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

  const safeProfile = profile as Profile | null;

  return {
    id: user.id,
    email: user.email,
    full_name: safeProfile?.full_name ?? null,
    role: safeProfile?.role ?? null,
  };
}

export { createClient, getCurrentUser };
