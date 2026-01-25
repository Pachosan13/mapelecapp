import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPanamaDateLabel } from "@/lib/dates/panama";

const MAX_STATUS_ITEMS = 8;
const MAX_TEXT_LENGTH = 80;

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
};

export default async function BuildingHistoryPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: building, error: buildingError } = await supabase
    .from("buildings")
    .select("id,name,address,service_flags,notes,created_at")
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

  const { data: visitsData, error: visitsError } = await supabase
    .from("visits")
    .select(
      "id,scheduled_for,assigned_tech_user_id,template:visit_templates(id,name)"
    )
    .eq("building_id", params.id)
    .order("scheduled_for", { ascending: false });

  const visits = (visitsData ?? []) as Array<{
    id: string;
    scheduled_for: string;
    assigned_tech_user_id: string | null;
    template: { id: string; name: string } | null;
  }>;

  const techIds = Array.from(
    new Set(visits.map((visit) => visit.assigned_tech_user_id).filter(Boolean))
  ) as string[];

  const { data: techProfiles } =
    techIds.length > 0
      ? await supabase.from("profiles").select("user_id,full_name").in(
          "user_id",
          techIds
        )
      : { data: [] };

  const techNameById = new Map(
    (techProfiles ?? []).map((tech) => [tech.user_id, tech.full_name])
  );

  const visitIds = visits.map((visit) => visit.id);
  const templateIds = Array.from(
    new Set(visits.map((visit) => visit.template?.id).filter(Boolean))
  ) as string[];

  const { data: latestResponses } =
    visitIds.length > 0
      ? await supabase
          .from("visit_latest_responses")
          .select(
            "visit_id,item_id,value_text,value_number,value_bool,created_at,created_by"
          )
          .in("visit_id", visitIds)
      : { data: [] };

  const { data: templateItems } =
    templateIds.length > 0
      ? await supabase
          .from("template_items")
          .select("id,label,item_type,sort_order")
          .in("template_id", templateIds)
      : { data: [] };

  const templateItemById = new Map(
    (templateItems ?? []).map((item) => [item.id, item])
  );

  const latestResponsesByVisitId = new Map<
    string,
    Array<{
      item_id: string;
      value_text: string | null;
      value_number: number | null;
      value_bool: boolean | null;
    }>
  >();

  (latestResponses ?? []).forEach((response) => {
    const list = latestResponsesByVisitId.get(response.visit_id) ?? [];
    list.push(response);
    latestResponsesByVisitId.set(response.visit_id, list);
  });

  const missingTechIds = techIds.filter((id) => !techNameById.has(id));
  if (missingTechIds.length > 0) {
    console.warn(
      `[ops/buildings/history] Missing tech profiles for ids: ${missingTechIds.join(
        ", "
      )}`
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/buildings" className="text-sm text-gray-500">
          ← Volver a buildings
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{building.name}</h1>
        <p className="text-gray-600">Historial del building</p>
      </div>

      <div className="mb-8 grid gap-4 rounded border p-4 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-gray-500">Address</p>
          <p className="text-sm font-medium">{building.address ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Service Flags</p>
          <p className="text-sm font-medium">{building.service_flags ?? "—"}</p>
        </div>
        <div className="md:col-span-2">
          <p className="text-xs uppercase text-gray-500">Notes</p>
          <p className="text-sm text-gray-700">{building.notes ?? "—"}</p>
        </div>
      </div>

      {visitsError ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando historial: {visitsError.message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Tech</th>
              <th className="px-4 py-3 font-medium">Template</th>
              <th className="px-4 py-3 font-medium">Último estado</th>
            </tr>
          </thead>
          <tbody>
            {visits.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={4}>
                  No hay visitas registradas para este building.
                </td>
              </tr>
            ) : (
              visits.map((visit) => {
                const techName =
                  (visit.assigned_tech_user_id &&
                    techNameById.get(visit.assigned_tech_user_id)) ||
                  (visit.assigned_tech_user_id
                    ? `Usuario ${visit.assigned_tech_user_id.slice(0, 6)}`
                    : "—");

                const responsesForVisit =
                  latestResponsesByVisitId.get(visit.id) ?? [];
                const latestItems = responsesForVisit
                  .map((response) => {
                    const item = templateItemById.get(response.item_id);
                    if (!item) {
                      return null;
                    }

                    let value: string = "—";
                    if (item.item_type === "checkbox") {
                      value = response.value_bool ? "✅" : "❌";
                    } else if (item.item_type === "number") {
                      value =
                        response.value_number !== null
                          ? response.value_number.toString()
                          : "—";
                    } else if (response.value_text) {
                      value = truncateText(response.value_text, MAX_TEXT_LENGTH);
                    }

                    return {
                      id: item.id,
                      label: item.label,
                      sort_order: item.sort_order ?? 0,
                      value,
                    };
                  })
                  .filter(Boolean)
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .slice(0, MAX_STATUS_ITEMS) as Array<{
                  id: string;
                  label: string;
                  sort_order: number;
                  value: string;
                }>;

                return (
                  <tr key={visit.id} className="border-t">
                    <td className="px-4 py-3">
                      {formatPanamaDateLabel(visit.scheduled_for)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{techName}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {visit.template?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-gray-700">
                        Último estado
                      </div>
                      {responsesForVisit.length === 0 ? (
                        <div className="mt-1 text-xs text-gray-500">
                          Sin respuestas aún.
                        </div>
                      ) : (
                        <ul className="mt-1 space-y-1 text-xs text-gray-700">
                          {latestItems.map((item) => (
                            <li key={item.id} className="flex gap-2">
                              <span className="min-w-[140px] text-gray-600">
                                {item.label}
                              </span>
                              <span>{item.value}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-2">
                        <Link
                          href={`/ops/visits/${visit.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ver historial de esta visita →
                        </Link>
                      </div>
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
