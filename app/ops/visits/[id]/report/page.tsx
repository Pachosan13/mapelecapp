import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isRecorridoPorPisosItem } from "@/lib/reports/serviceReport";

type TemplateItem = {
  id: string;
  label: string;
  item_type: string;
  required: boolean | null;
  sort_order: number | null;
};

type VisitResponse = {
  item_id: string;
  value_text: string | null;
  value_number: number | null;
  value_bool: boolean | null;
  created_at: string;
};

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

const formatResponseValue = (
  itemType: string,
  response?: VisitResponse
): string => {
  if (!response) {
    return "—";
  }

  if (itemType === "checkbox") {
    if (response.value_bool === null) {
      return "—";
    }
    return response.value_bool ? "Sí" : "No";
  }

  if (itemType === "number") {
    return response.value_number !== null ? response.value_number.toString() : "—";
  }

  const trimmed = (response.value_text ?? "").trim();
  return trimmed || "—";
};

const formatBool = (value: boolean) => (value ? "Sí" : "No");

type RecorridoRow = {
  piso: string;
  presion_entrada: number | null;
  presion_salida: number | null;
  estacion_control_abierta: boolean;
  estacion_control_cerrada: boolean;
  valvula_reguladora: boolean;
  estado_manometro: boolean;
  gabinetes_manguera: boolean;
  extintores: boolean;
  observacion: string;
};

const looksLikeJson = (value: string) => {
  const trimmed = value.trim();
  return trimmed.startsWith("[") || trimmed.startsWith("{");
};

const normalizeRecorridoRow = (value: any): RecorridoRow | null => {
  if (!value || typeof value !== "object") return null;
  return {
    piso: typeof value.piso === "string" ? value.piso : "",
    presion_entrada:
      typeof value.presion_entrada === "number" &&
      Number.isFinite(value.presion_entrada)
        ? value.presion_entrada
        : null,
    presion_salida:
      typeof value.presion_salida === "number" &&
      Number.isFinite(value.presion_salida)
        ? value.presion_salida
        : null,
    estacion_control_abierta: Boolean(value.estacion_control_abierta),
    estacion_control_cerrada: Boolean(value.estacion_control_cerrada),
    valvula_reguladora: Boolean(value.valvula_reguladora),
    estado_manometro: Boolean(value.estado_manometro),
    gabinetes_manguera: Boolean(value.gabinetes_manguera),
    extintores: Boolean(value.extintores),
    observacion: typeof value.observacion === "string" ? value.observacion : "",
  };
};

const parseRecorridoRows = (value?: string | null): RecorridoRow[] | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((row) => normalizeRecorridoRow(row))
      .filter(Boolean) as RecorridoRow[];
  } catch {
    return null;
  }
};

export default async function OpsVisitReportPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select(
      "id,building_id,template_id,assigned_tech_user_id,status,completed_at,building:buildings(id,name),template:visit_templates(id,name)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (visitError || !visit) {
    return (
      <div className="min-h-screen p-8">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {visitError
            ? `Error cargando reporte: ${visitError.message}`
            : "No se encontró la visita solicitada."}
        </div>
      </div>
    );
  }

  const { data: templateItems } =
    visit.template_id
      ? await supabase
          .from("template_items")
          .select("id,label,item_type,required,sort_order")
          .eq("template_id", visit.template_id)
          .order("sort_order", { ascending: true })
      : { data: [] };

  const { data: responses } = await supabase
    .from("visit_responses")
    .select("item_id,value_text,value_number,value_bool,created_at")
    .eq("visit_id", visit.id);

  const { data: techProfiles } = visit.assigned_tech_user_id
    ? await supabase
        .from("profiles")
        .select("user_id,full_name")
        .eq("user_id", visit.assigned_tech_user_id)
    : { data: [] };

  const techName =
    techProfiles?.[0]?.full_name?.trim() ||
    (visit.assigned_tech_user_id
      ? `Usuario ${visit.assigned_tech_user_id.slice(0, 6)}`
      : "—");

  const latestResponseByItemId = new Map<string, VisitResponse>();
  (responses ?? []).forEach((response: VisitResponse) => {
    const existing = latestResponseByItemId.get(response.item_id);
    if (!existing) {
      latestResponseByItemId.set(response.item_id, response);
      return;
    }
    if (new Date(response.created_at) > new Date(existing.created_at)) {
      latestResponseByItemId.set(response.item_id, response);
    }
  });

  const buildingName = visit.building?.name ?? "Building";
  const templateName = visit.template?.name ?? "Formulario";
  const buildingHref = visit.building?.id
    ? `/ops/buildings/${visit.building.id}/history`
    : "/ops/buildings";

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href={buildingHref} className="text-sm text-gray-500">
          ← Volver al historial del building
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Reporte de visita</h1>
        <p className="text-gray-600">
          {buildingName} · {templateName}
        </p>
      </div>

      <div className="mb-6 grid gap-4 rounded border p-4 text-sm text-gray-700 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-gray-500">Building</p>
          <p className="text-sm font-medium">{buildingName}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Formulario</p>
          <p className="text-sm font-medium">{templateName}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Tech</p>
          <p className="text-sm font-medium">{techName}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Completado</p>
          <p className="text-sm font-medium">
            {formatPanamaDateTime(visit.completed_at)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {(templateItems ?? []).length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={3}>
                  No hay items configurados para esta plantilla.
                </td>
              </tr>
            ) : (
              (templateItems ?? []).map((item: TemplateItem) => {
                const response = latestResponseByItemId.get(item.id);
                const isRecorridoItem = isRecorridoPorPisosItem(item.label);
                const rawText = (response?.value_text ?? "").trim();
                const recorridoRows = isRecorridoItem
                  ? parseRecorridoRows(rawText)
                  : null;
                const fallbackText = rawText
                  ? looksLikeJson(rawText)
                    ? "—"
                    : rawText
                  : "—";
                return (
                  <tr key={item.id} className="border-t align-top">
                    <td className="px-4 py-3 font-medium">{item.label}</td>
                    <td className="px-4 py-3 text-gray-600">{item.item_type}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {recorridoRows ? (
                        <div className="overflow-x-auto rounded border">
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-gray-50 text-gray-600">
                              <tr>
                                <th className="px-3 py-2 font-medium">Piso</th>
                                <th className="px-3 py-2 font-medium">
                                  Presión entrada
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Presión salida
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Estación control abierta
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Estación control cerrada
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Válvula reguladora
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Estado manómetro
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Gabinetes/manguera
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Extintores
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Observación
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {recorridoRows.length === 0 ? (
                                <tr className="border-t">
                                  <td
                                    className="px-3 py-3 text-gray-500"
                                    colSpan={10}
                                  >
                                    Sin filas.
                                  </td>
                                </tr>
                              ) : null}
                              {recorridoRows.map((row, index) => (
                                <tr key={`${item.id}-${index}`} className="border-t">
                                  <td className="px-3 py-2">{row.piso || "—"}</td>
                                  <td className="px-3 py-2">
                                    {row.presion_entrada ?? "—"}
                                  </td>
                                  <td className="px-3 py-2">
                                    {row.presion_salida ?? "—"}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatBool(row.estacion_control_abierta)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatBool(row.estacion_control_cerrada)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatBool(row.valvula_reguladora)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatBool(row.estado_manometro)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatBool(row.gabinetes_manguera)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatBool(row.extintores)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {row.observacion || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        isRecorridoItem
                          ? fallbackText
                          : formatResponseValue(item.item_type, response)
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
