import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadMedia } from "@/lib/media/service";

export const dynamic = "force-dynamic";

/**
 * Subida programática de evidencia para la cola offline de fotos (lib/offline/photoQueue).
 * Mismo criterio de acceso por CUADRILLA que el server action `handleMediaUpload`.
 * Devuelve JSON (no redirect) para poder reintentar desde el cliente al reconectar.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const visitId = String(form.get("visit_id") ?? "");
  const system = String(form.get("system") ?? "").trim() || null;

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "archivo requerido" }, { status: 400 });
  }
  if (!visitId) {
    return NextResponse.json({ ok: false, error: "visita requerida" }, { status: 400 });
  }

  const { data: visit } = await supabase
    .from("visits")
    .select("id,building_id,assigned_tech_user_id,assigned_crew_id")
    .eq("id", visitId)
    .maybeSingle();

  if (!visit || !visit.building_id) {
    return NextResponse.json({ ok: false, error: "visita no encontrada" }, { status: 404 });
  }

  const canAccess =
    visit.assigned_tech_user_id === user.id ||
    (Boolean(visit.assigned_crew_id) &&
      visit.assigned_crew_id ===
        (
          await supabase
            .from("profiles")
            .select("home_crew_id")
            .eq("user_id", user.id)
            .maybeSingle()
        ).data?.home_crew_id);

  if (!canAccess) {
    return NextResponse.json({ ok: false, error: "sin acceso" }, { status: 403 });
  }

  const { error } = await uploadMedia({
    buildingId: visit.building_id,
    visitId: visit.id,
    file,
    kind: "evidence",
    system,
  });

  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
