import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decidirAccesoInforme, visitaEsFacturable } from "@/lib/reports/acceso";
import { generarInformePdf } from "@/lib/reports/generarInforme";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get("buildingId")?.trim() ?? "";
    const reportDate = searchParams.get("reportDate")?.trim() ?? "";
    const visitId = searchParams.get("visitId")?.trim() ?? "";
    // El informe se generaba SIEMPRE como `attachment`: el navegador lo bajaba y no
    // había forma de volver a verlo desde la app — en una tablet el archivo se pierde
    // en la carpeta de descargas (William, 6-ago-2026). Con `?view=1` se abre en el
    // visor del navegador, que ya trae su propio botón de descarga.
    const inline = searchParams.get("view") === "1";

    if (!visitId && (!buildingId || !reportDate)) {
      return NextResponse.json(
        { error: "Faltan parámetros: visitId, o buildingId y reportDate." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const supabaseDb = supabase.schema("public");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseDb
      .from("profiles")
      .select("user_id, full_name, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const role = profileError ? null : profile?.role ?? null;
    const acceso = decidirAccesoInforme({ role, visitId });
    if (!acceso.ok) {
      return new Response(acceso.motivo, { status: acceso.status });
    }

    // Rol `facturacion` (solo lectura): el informe existe solo para visitas COMPLETADAS. Se
    // comprueba aquí, con el cliente de administración, antes de leer o generar nada.
    if (acceso.requiereVisitaCompletada) {
      const { data: visita } = await createAdminClient()
        .from("visits")
        .select("status")
        .eq("id", visitId)
        .maybeSingle();
      if (!visita) return new Response("Not found", { status: 404 });
      if (!visitaEsFacturable(visita.status)) {
        return new Response(
          "Este informe todavía no está disponible: la visita no está completada.",
          { status: 403 }
        );
      }
    }

    const informe = await generarInformePdf({
      visitId: visitId || undefined,
      buildingId,
      reportDate,
      userId: user.id,
      lecturaSolo: acceso.soloLectura,
    });
    if (!informe.ok) {
      return NextResponse.json({ error: informe.error }, { status: 400 });
    }

    return new NextResponse(Buffer.from(informe.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${informe.filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[service-report] pdf error", err);
    if (process.env.NODE_ENV !== "production") {
      return Response.json(
        {
          ok: false,
          error: String(err?.message ?? err),
          stack: String(err?.stack ?? ""),
        },
        { status: 500 }
      );
    }
    return new Response("Error generating PDF", { status: 500 });
  }
}
