import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { createClient } from "@/lib/supabase/server";
import {
  formatResponseValue,
  getServiceReportData,
  isRecorridoPorPisosItem,
  parseRecorridoPorPisosValue,
} from "@/lib/reports/serviceReport";
import {
  renderServiceReportPdf,
  type PdfSection,
  type PdfVisitBlock,
  type PdfResponseValue,
} from "@/lib/reports/pdf";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PANAMA_TIME_ZONE = "America/Panama";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  ready: "Listo para enviar",
  sent: "Enviado al cliente",
};

const formatPanamaDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PA", {
    timeZone: PANAMA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatPanamaDateLong = (value: string) => {
  const d = value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("es-PA", {
    timeZone: PANAMA_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get("buildingId")?.trim() ?? "";
    const reportDate = searchParams.get("reportDate")?.trim() ?? "";

    if (!buildingId || !reportDate) {
      return NextResponse.json(
        { error: "Faltan parámetros buildingId y reportDate." },
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
    if (role !== "ops_manager" && role !== "director") {
      return new Response("Forbidden", { status: 403 });
    }

    const { data, error } = await getServiceReportData({
      buildingId,
      reportDate,
      userId: user.id,
    });

    if (error || !data) {
      return NextResponse.json(
        { error: error ?? "No se pudo generar el reporte." },
        { status: 400 }
      );
    }

    // ── Supplemental: building meta + crew per visit ──
    const { data: buildingMeta } = await supabaseDb
      .from("buildings")
      .select("systems,address")
      .eq("id", buildingId)
      .maybeSingle();

    const allVisitIds = Array.from(
      new Set(data.sections.flatMap((s) => s.visits.map((v) => v.id)))
    );

    const crewByVisitId = new Map<string, string>();
    if (allVisitIds.length > 0) {
      const { data: visitCrews } = await supabaseDb
        .from("visits")
        .select("id,crew:crews(name)")
        .in("id", allVisitIds);
      (visitCrews ?? []).forEach((row: any) => {
        if (row?.crew?.name) crewByVisitId.set(row.id, row.crew.name);
      });
    }

    // ── Media: list + download image bytes ──
    const mediaByVisitId = new Map<
      string,
      Array<{ storage_path: string; mime_type: string; size_bytes: number }>
    >();
    // Firmas de recibido (kind=signature) — se estampan en el bloque de firmas, no en evidencia.
    const signatureRows: Array<{ storage_path: string; mime_type: string }> = [];
    if (allVisitIds.length > 0) {
      const { data: mediaRows } = await supabase
        .from("media")
        .select("visit_id,storage_path,mime_type,size_bytes,kind")
        .eq("building_id", buildingId)
        .in("visit_id", allVisitIds)
        .order("created_at", { ascending: true });
      (mediaRows ?? []).forEach((row) => {
        if (!row.visit_id) return;
        if (row.kind === "signature") {
          signatureRows.push({
            storage_path: row.storage_path,
            mime_type: row.mime_type,
          });
          return;
        }
        if (!mediaByVisitId.has(row.visit_id)) mediaByVisitId.set(row.visit_id, []);
        mediaByVisitId.get(row.visit_id)!.push({
          storage_path: row.storage_path,
          mime_type: row.mime_type,
          size_bytes: row.size_bytes,
        });
      });
    }

    const downloadImage = async (
      storagePath: string,
      mime: string
    ): Promise<{ bytes: Uint8Array; isPng: boolean } | null> => {
      const m = (mime ?? "").toLowerCase();
      const isPng = m === "image/png";
      const isJpeg = m === "image/jpeg" || m === "image/jpg";
      if (!isPng && !isJpeg) return null;
      const { data: blob, error: dErr } = await supabase.storage
        .from("media")
        .download(storagePath);
      if (dErr || !blob) return null;
      return { bytes: new Uint8Array(await blob.arrayBuffer()), isPng };
    };

    // ── Build PDF sections ──
    const sections: PdfSection[] = [];
    for (const section of data.sections) {
      const visits: PdfVisitBlock[] = [];
      for (const [vIndex, visit] of section.visits.entries()) {
        const rows: PdfResponseValue[] = [];
        let recorrido: PdfVisitBlock["recorrido"] = null;

        for (const item of section.items) {
          const response = visit.latest_response_by_item_id.get(item.id);
          if (isRecorridoPorPisosItem(item.label)) {
            const parsed = parseRecorridoPorPisosValue(response?.value_text ?? null);
            if (parsed) {
              recorrido = { label: item.label, rows: parsed };
              continue;
            }
          }
          const value = formatResponseValue(item.item_type, response);
          const kind: PdfResponseValue["kind"] =
            item.item_type === "checkbox"
              ? "checkbox"
              : item.item_type === "number"
                ? "number"
                : "text";
          rows.push({ label: item.label, value, kind });
        }

        const mediaList = mediaByVisitId.get(visit.id) ?? [];
        const media = [];
        for (const m of mediaList) {
          const image = await downloadImage(m.storage_path, m.mime_type);
          media.push({
            name: m.storage_path.split("/").pop() || m.storage_path,
            sizeMb: (m.size_bytes / 1024 / 1024).toFixed(2),
            image,
          });
        }

        visits.push({
          index: vIndex + 1,
          completedAtLabel: formatPanamaDateTime(visit.completed_at),
          crewLabel: crewByVisitId.get(visit.id) ?? null,
          rows,
          recorrido,
          media,
          mediaCount: mediaList.length,
        });
      }
      sections.push({ title: section.template_name, visits });
    }

    const logoPath = path.join(process.cwd(), "public", "logosemco.png");
    const logoBytes = new Uint8Array(await readFile(logoPath));

    // La firma más reciente del día (la última que se capturó).
    const lastSignature = signatureRows.length
      ? signatureRows[signatureRows.length - 1]
      : null;
    const signatureImage = lastSignature
      ? await downloadImage(lastSignature.storage_path, lastSignature.mime_type)
      : null;

    const pdfBytes = await renderServiceReportPdf({
      buildingName: data.building.name,
      buildingAddress: buildingMeta?.address ?? null,
      reportDateLabel: formatPanamaDateLong(data.report_date),
      reportId: data.report?.id ?? null,
      statusLabel: data.report?.status
        ? STATUS_LABELS[data.report.status] ?? data.report.status
        : null,
      systems: (buildingMeta?.systems as string[] | null) ?? [],
      clientSummary: data.report?.client_summary ?? null,
      internalNotes: data.report?.internal_notes ?? null,
      sections,
      logoBytes,
      generatedAtLabel: formatPanamaDateTime(new Date().toISOString()),
      signatureImage,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="informe-servicio-${reportDate}.pdf"`,
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
