import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

type ServerSupabaseClient = ReturnType<typeof createServerClient<Database, "public">>;

export async function createClient(): Promise<ServerSupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient<Database, "public">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () =>
          cookieStore.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cookiesToSet) => {
          // Next NO deja escribir cookies durante el render de un Server Component:
          // cookies().set() lanza "Cookies can only be modified in a Server Action or
          // Route Handler". Y supabase-ssr llama a setAll solo cuando le toca RENOVAR el
          // token, o sea cada tanto y no siempre: por eso la pantalla fallaba a ratos y
          // parecía cosa de suerte.
          //
          // Se puede ignorar sin perder la sesión porque el MIDDLEWARE ya escribe las
          // cookies renovadas en la respuesta (middleware.ts, setAll sobre request y
          // response). Este cliente solo LEE; quien persiste es el middleware.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set({ name, value, ...options });
            }
          } catch {
            // Render de Server Component: el middleware ya se encargó.
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
  home_crew_id?: string | null;
}

async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  
  // getUser() sale por RED al servidor de Auth. Si esa llamada falla de verdad (no
  // devuelve error: TIRA) la excepción sube hasta el render y el usuario ve la pantalla
  // de "Application error". Ya nos pasó en el middleware con Supabase degradado el
  // 27-ago y allá se resolvió con un reloj; acá no había ninguna guarda.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  try {
    const res = await supabase.auth.getUser();
    if (res.error || !res.data.user) return null;
    user = res.data.user;
  } catch (e) {
    console.log("[getCurrentUser] getUser lanzó:", (e as Error)?.message);
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
