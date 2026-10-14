import path from "path";
import { readFile } from "fs/promises";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
import { nombreArchivoInforme } from "@/lib/reports/nombreArchivo";

// Armado del informe PDF. Vivía dentro de la ruta GET /api/reports/service-report; se sacó
// aquí para que el envío al cliente por correo adjunte EXACTAMENTE el mismo PDF que se
// descarga (pedido de William, 14-oct-2026).

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

export type InformeGenerado =
  | {
      ok: true;
      bytes: Uint8Array;
      filename: string;
      buildingId: string;
      buildingName: string;
      reportDate: string;
      reportDateLabel: string;
      sectionTitles: string[];
    }
  | { ok: false; error: string };

/**
 * Genera el PDF del informe. El llamador ya verificó el rol (y, para `lecturaSolo`, que la
 * visita esté completada). `lecturaSolo` lee con el cliente de administración sin escribir nada.
 */
export async function generarInformePdf(params: {
  visitId?: string;
  buildingId?: string;
  reportDate?: string;
  userId: string;
  lecturaSolo: boolean;
}): Promise<InformeGenerado> {
  const { visitId, buildingId, reportDate, userId, lecturaSolo } = params;

  // Quién lee los datos del informe: los gerentes y el director, con sus propios permisos;
  // facturación, con el cliente de administración (no tiene políticas de lectura).
  const supabase = await createClient();
  const db = lecturaSolo
    ? (createAdminClient() as unknown as typeof supabase)
    : supabase;
  const dbPublic = db.schema("public");

const { data, error } = await getServiceReportData(
  visitId
    ? { visitId, userId, lecturaSolo }
    : { buildingId, reportDate, userId, lecturaSolo }
);

if (error || !data) {
  return { ok: false, error: error ?? "No se pudo generar el reporte." };
}

  // building + fecha efectivos (en modo visitId se derivan de la visita).
  const effBuildingId = data.building.id;
  const effReportDate = data.report_date;

  // ── Supplemental: building meta + crew per visit ──
  const { data: buildingMeta } = await dbPublic
    .from("buildings")
    .select("systems,address")
    .eq("id", effBuildingId)
    .maybeSingle();

  const allVisitIds = Array.from(
    new Set(data.sections.flatMap((s) => s.visits.map((v) => v.id)))
  );

  const crewByVisitId = new Map<string, string>();
  if (allVisitIds.length > 0) {
    const { data: visitCrews } = await dbPublic
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
    Array<{
      storage_path: string;
      mime_type: string;
      size_bytes: number;
      system: string | null;
      label: string | null;
    }>
  >();
  // Firmas de recibido (kind=signature) — se estampan en el bloque de firmas, no en evidencia.
  const signatureRows: Array<{
    storage_path: string;
    mime_type: string;
    signerRole: string | null;
  }> = [];
  if (allVisitIds.length > 0) {
    const { data: mediaRows } = await db
      .from("media")
      .select("visit_id,storage_path,mime_type,size_bytes,kind,system,label,signer_role")
      .eq("building_id", effBuildingId)
      .in("visit_id", allVisitIds)
      .order("created_at", { ascending: true });
    (mediaRows ?? []).forEach((row) => {
      if (!row.visit_id) return;
      if (row.kind === "signature") {
        signatureRows.push({
          storage_path: row.storage_path,
          mime_type: row.mime_type,
          // Firmas viejas (o escritas por un deploy anterior a signer_role)
          // llevan el rol en `system`. Se leen los dos formatos.
          signerRole: row.signer_role ?? row.system ?? null,
        });
        return;
      }
      if (!mediaByVisitId.has(row.visit_id)) mediaByVisitId.set(row.visit_id, []);
      mediaByVisitId.get(row.visit_id)!.push({
        storage_path: row.storage_path,
        mime_type: row.mime_type,
        size_bytes: row.size_bytes,
        // El sistema viajaba hasta acá y se quedaba en el camino: el PDF pintaba la
        // foto sin decir de cuál sistema era.
        system: row.system ?? null,
        label: row.label ?? null,
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
    const { data: blob, error: dErr } = await db.storage
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
        const value = formatResponseValue(item.item_type, response, item.label);
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
          system: m.system,
          label: m.label,
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

  // Firma más reciente por rol. Legacy (rol nulo) = firma de cliente.
  const reversed = [...signatureRows].reverse();
  const lastClientSig = reversed.find((s) => s.signerRole !== "tecnico") ?? null;
  const lastTechSig = reversed.find((s) => s.signerRole === "tecnico") ?? null;
  const signatureImage = lastClientSig
    ? await downloadImage(lastClientSig.storage_path, lastClientSig.mime_type)
    : null;
  const technicianSignatureImage = lastTechSig
    ? await downloadImage(lastTechSig.storage_path, lastTechSig.mime_type)
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
    technicianSignatureImage,
  });

  return {
    ok: true,
    bytes: pdfBytes,
    filename: nombreArchivoInforme(
      effReportDate,
      data.building.name,
      sections.map((s) => s.title)
    ),
    buildingId: effBuildingId,
    buildingName: data.building.name,
    reportDate: effReportDate,
    reportDateLabel: formatPanamaDateLong(data.report_date),
    sectionTitles: sections.map((s) => s.title),
  };
}
