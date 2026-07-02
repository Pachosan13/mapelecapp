import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente Supabase con SERVICE ROLE — bypassa RLS.
 *
 * ⚠️ SOLO SERVER. Nunca importar en un client component ni exponer la key al browser
 * (no lleva prefijo NEXT_PUBLIC_). Usar únicamente en server actions ya protegidas por
 * verificación de rol server-side (ej. app/ops/staff/actions.ts → createCrew, gated a
 * ops_manager/director). Existe porque la tabla `crews` no tiene policy RLS de INSERT.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno."
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
