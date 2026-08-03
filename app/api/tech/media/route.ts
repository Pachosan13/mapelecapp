import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadMedia, MEDIA_BUCKET, type SignerRole } from "@/lib/media/service";

export const dynamic = "force-dynamic";

/**
 * Subida programática para la cola offline (lib/offline/photoQueue): evidencia Y FIRMAS.
 *
 * Las firmas entraron acá el 3-ago-2026 por reporte de William: *"tiene que arreglar el
 * tema de la firma, allí siempre hay problema… hice como me dijiste y no se guardó
 * ninguna"*. Era la ÚNICA pieza del formulario sin guardado offline — las respuestas
 * (outbox en localStorage) y las fotos (esta cola) ya sobrevivían sin señal, pero la
 * firma se mandaba con un submit directo y en un sótano se perdía entera.
 *
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
  // `kind` llega solo desde la cola; sin él se comporta como siempre (evidencia).
  const esFirma = String(form.get("kind") ?? "evidence").trim() === "signature";
  const signerRole: SignerRole =
    String(form.get("signer_role") ?? "cliente").trim() === "tecnico"
      ? "tecnico"
      : "cliente";

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

  if (!esFirma) {
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

  // ── Firma ────────────────────────────────────────────────────────────────
  // Una firma por rol y por visita: la nueva REEMPLAZA a la anterior.
  //
  // 🐛 ORDEN — se borra ANTES de subir, y esto NO es un detalle.
  // La tabla tiene un índice único `media_una_firma_por_visita_y_rol`. El código
  // anterior subía primero y borraba después, así que al firmar de nuevo el mismo
  // rol el INSERT chocaba con la restricción y devolvía 400: la firma nueva NUNCA
  // entraba. Eso es una buena parte del "la firma siempre da problema" que
  // reportó William — no era solo la señal.
  //
  // Borrar primero es seguro AHORA porque la firma ya vive en la cola del equipo
  // del técnico (IndexedDB): si la subida falla después del borrado, el PNG sigue
  // en su celular y se reintenta solo. Antes no había esa red y por eso el orden
  // inverso tenía sentido.
  const { data: previas } = await supabase
    .from("media")
    .select("id,storage_path")
    .eq("visit_id", visit.id)
    .eq("kind", "signature")
    .eq("signer_role", signerRole);

  if (previas?.length) {
    await supabase.from("media").delete().in("id", previas.map((p) => p.id));
  }

  const { error } = await uploadMedia({
    buildingId: visit.building_id,
    visitId: visit.id,
    file,
    kind: "signature",
    signerRole,
  });

  if (error) {
    // La firma sigue en la cola del equipo → el cliente reintenta.
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  // Los archivos viejos se limpian al final: si esto falla queda un PNG huérfano
  // en el bucket (inofensivo), nunca una firma de menos.
  if (previas?.length) {
    await supabase.storage
      .from(MEDIA_BUCKET)
      .remove(previas.map((p) => p.storage_path));
  }

  return NextResponse.json({ ok: true });
}
