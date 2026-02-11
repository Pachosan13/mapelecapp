import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { getPanamaDayRange } from "@/lib/dates/panama";
import { formatDateOnlyLabel } from "@/lib/dates/dateOnly";
import { createClient } from "@/lib/supabase/server";
import {
  formatResponseValue,
  getServiceReportData,
} from "@/lib/reports/serviceReport";

const PANAMA_TIME_ZONE = "America/Panama";

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

type SearchParams = {
  date?: string;
};

async function updateReportNotes(formData: FormData) {
  "use server";

  const { user } = await requireRole(["ops_manager", "director"]);
  const reportId = String(formData.get("report_id") ?? "");
  const clientSummary = String(formData.get("client_summary") ?? "").trim();
  const internalNotes = String(formData.get("internal_notes") ?? "").trim();

  if (!reportId) {
    return;
  }

  const supabase = (await createClient()).schema("public");
  await supabase
    .from("service_reports")
    .update({
      client_summary: clientSummary || null,
      internal_notes: internalNotes || null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", reportId);
}

async function markReportReady(formData: FormData) {
  "use server";

  const { user } = await requireRole(["ops_manager", "director"]);
  const reportId = String(formData.get("report_id") ?? "");

  if (!reportId) {
    return;
  }

  const supabase = (await createClient()).schema("public");
  await supabase
    .from("service_reports")
    .update({
      status: "ready",
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", reportId)
    .eq("status", "draft");
}

async function sendReport(formData: FormData) {
  "use server";

  const { user } = await requireRole(["ops_manager", "director"]);
  const reportId = String(formData.get("report_id") ?? "");

  if (!reportId) {
    return;
  }

  const supabase = (await createClient()).schema("public");
  await supabase
    .from("service_reports")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_by: user.id,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", reportId)
    .eq("status", "ready");
}

export default async function ServiceReportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  const { user } = await requireRole(["ops_manager", "director"]);
  const isOpsManager = user.role === "ops_manager";
  const reportDate = searchParams?.date?.trim() ?? "";
  const dateRange = reportDate ? getPanamaDayRange(reportDate) : null;

  if (reportDate && !dateRange) {
    return (
      <div className="min-h-screen p-8">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Fecha inválida. Usa formato YYYY-MM-DD.
        </div>
      </div>
    );
  }

  const supabase = (await createClient()).schema("public");
  const { data: building, error: buildingError } = await supabase
    .from("buildings")
    .select("id,name")
    .eq("id", params.id)
    .maybeSingle();

  if (buildingError) {
    return (
      <div className="min-h-screen p-8">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando building: {buildingError.message}
        </div>
      </div>
    );
  }

  if (!building) {
    notFound();
  }

  const { data: reportData, error: reportError } = reportDate
    ? await getServiceReportData({
        buildingId: building.id,
        reportDate,
        userId: user.id,
      })
    : { data: null, error: null };

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href={`/ops/buildings/${params.id}/history`} className="text-sm text-gray-500">
          ← Volver al historial del building
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <img
            src="/logomapelec.png"
            alt="Mapelec"
            className="h-10 w-auto"
          />
          <div>
            <h1 className="text-2xl font-bold">Service report del día</h1>
            <p className="text-gray-600">{building.name}</p>
          </div>
        </div>
      </div>

      <form className="mb-6 flex flex-wrap items-end gap-4" method="get">
        <div>
          <label className="mb-1 block text-sm font-medium">Fecha de completado</label>
          <input
            type="date"
            name="date"
            defaultValue={reportDate}
            className="rounded border px-3 py-2"
          />
        </div>
        <button type="submit" className="rounded border px-4 py-2">
          Cargar
        </button>
      </form>

      {reportError ? (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando reporte: {reportError}
        </div>
      ) : null}

      {!reportDate ? (
        <div className="rounded border border-dashed p-6 text-sm text-gray-600">
          Selecciona una fecha para ver el reporte del día.
        </div>
      ) : null}

      {reportData ? (
        <div className="space-y-6">
          <div className="rounded border p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-gray-500">Fecha del reporte</p>
                <p className="text-sm font-medium">
                  {formatDateOnlyLabel(reportData.report_date)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Se agrupa por día calendario en {reportData.time_zone}.
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Estado editorial</p>
                <p className="text-sm font-medium">
                  {reportData.report?.status ?? "draft"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isOpsManager ? (
                  <>
                    <form action={markReportReady}>
                      <input
                        type="hidden"
                        name="report_id"
                        value={reportData.report?.id ?? ""}
                      />
                      <button
                        type="submit"
                        className="rounded border px-4 py-2 text-sm"
                        disabled={reportData.report?.status !== "draft"}
                      >
                        Marcar listo
                      </button>
                    </form>
                    <form action={sendReport}>
                      <input
                        type="hidden"
                        name="report_id"
                        value={reportData.report?.id ?? ""}
                      />
                      <button
                        type="submit"
                        className="rounded bg-black px-4 py-2 text-sm text-white"
                        disabled={reportData.report?.status !== "ready"}
                      >
                        ENVIAR
                      </button>
                    </form>
                  </>
                ) : null}
                <a
                  href={`/api/reports/service-report?buildingId=${building.id}&reportDate=${reportDate}`}
                  className="rounded border px-4 py-2 text-sm"
                >
                  Exportar reporte
                </a>
              </div>
            </div>
          </div>

          <form action={updateReportNotes} className="grid gap-4 rounded border p-4">
            <input type="hidden" name="report_id" value={reportData.report?.id ?? ""} />
            <div>
              <label className="mb-1 block text-sm font-medium">
                Resumen para cliente
              </label>
              <textarea
                name="client_summary"
                defaultValue={reportData.report?.client_summary ?? ""}
                readOnly={!isOpsManager}
                className="min-h-[120px] w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Notas internas</label>
              <textarea
                name="internal_notes"
                defaultValue={reportData.report?.internal_notes ?? ""}
                readOnly={!isOpsManager}
                className="min-h-[120px] w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              {isOpsManager ? (
                <button type="submit" className="rounded border px-4 py-2 text-sm">
                  Guardar notas
                </button>
              ) : null}
            </div>
          </form>

          {reportData.sections.length === 0 ? (
            <div className="rounded border border-dashed p-6 text-sm text-gray-600">
              No hay visitas completadas para este día.
            </div>
          ) : (
            reportData.sections.map((section) => (
              <div key={section.template_id} className="rounded border p-4">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">{section.template_name}</h2>
                </div>

                {section.visits.map((visit, index) => (
                  <div key={visit.id} className="mb-6 rounded border border-gray-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium">
                        Ejecución #{index + 1} · {formatPanamaDateTime(visit.completed_at)}
                      </p>
                      {visit.equipment_labels.length > 0 ? (
                        <p className="text-xs text-gray-600">
                          Equipo: {visit.equipment_labels.join(", ")}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-3 overflow-x-auto rounded border">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <th className="px-4 py-3 font-medium">Item</th>
                            <th className="px-4 py-3 font-medium">Tipo</th>
                            <th className="px-4 py-3 font-medium">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.items.length === 0 ? (
                            <tr>
                              <td className="px-4 py-6 text-gray-500" colSpan={3}>
                                No hay items configurados para esta plantilla.
                              </td>
                            </tr>
                          ) : (
                            section.items.map((item) => {
                              const response = visit.latest_response_by_item_id.get(item.id);
                              return (
                                <tr key={item.id} className="border-t">
                                  <td className="px-4 py-3 font-medium">{item.label}</td>
                                  <td className="px-4 py-3 text-gray-600">
                                    {item.item_type}
                                  </td>
                                  <td className="px-4 py-3 text-gray-700">
                                    {formatResponseValue(item.item_type, response)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
