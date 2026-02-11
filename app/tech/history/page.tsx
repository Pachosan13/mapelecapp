export const dynamic = "force-dynamic";
export const revalidate = 0;
import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { formatPanamaDateLabel } from "@/lib/dates/panama";
import { formatDateOnlyLabel } from "@/lib/dates/dateOnly";
import type { Database } from "@/lib/database.types";

type SearchParams = {
  status?: string;
  building?: string;
};

type VisitStatus = NonNullable<Database["public"]["Tables"]["visits"]["Row"]["status"]>;

const ALLOWED_STATUS_SET = new Set<string>([
  "planned",
  "in_progress",
  "completed",
  "missed",
]);

function toVisitStatus(v?: string | null): VisitStatus | null {
  if (!v) return null;
  return ALLOWED_STATUS_SET.has(v) ? (v as VisitStatus) : null;
}

const formatStatus = (status?: string | null) => {
  if (!status) return "Sin estado";
  return status.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
};

const safeFormatDate = (value?: string | null) => {
  if (!value) return "—";
  try {
    return formatPanamaDateLabel(value);
  } catch (error) {
    console.error("Tech history date format error:", error);
    return "—";
  }
};

export default async function TechHistoryPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  noStore();
  const supabase = await createClient();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  const userId = userRes.user?.id ?? "";
  if (!userRes.user) {
    return (
      <div className="min-h-screen p-8">
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          NO USER / NO SESSION{userErr?.message ? `: ${userErr.message}` : ""}
        </div>
      </div>
    );
  }

  const user = await getCurrentUser();

  if (!user || user.role !== "tech") {
    redirect("/login");
  }

  const selectedStatus = searchParams?.status?.trim() ?? "";
  const selectedBuilding = searchParams?.building?.trim() ?? "";

  const visitsQuery = supabase
    .from("visits")
    .select(
      "id,building_id,template_id,status,scheduled_for,created_at,completed_at",
      { count: "exact" }
    )
    .eq("assigned_tech_user_id", userId)
    .order("scheduled_for", { ascending: false })
    .order("created_at", { ascending: false });

  const statusTyped = toVisitStatus(selectedStatus);
  if (statusTyped) {
    visitsQuery.eq("status", statusTyped);
  }

  if (selectedBuilding) {
    visitsQuery.eq("building_id", selectedBuilding);
  }

  const { data: visits, error: visitsErr } = await visitsQuery;
  const visitsData = (visits ?? []) as Array<{
    id: string;
    building_id: string | null;
    template_id: string | null;
    scheduled_for: string;
    status: string | null;
    completed_at: string | null;
  }>;

  const buildingIds = Array.from(
    new Set(visitsData.map((visit) => visit.building_id).filter(Boolean))
  ) as string[];
  const templateIds = Array.from(
    new Set(visitsData.map((visit) => visit.template_id).filter(Boolean))
  ) as string[];

  const [buildingsResult, templatesResult] = await Promise.all([
    buildingIds.length > 0
      ? supabase.from("buildings").select("id,name").in("id", buildingIds)
      : Promise.resolve({ data: [], error: null }),
    templateIds.length > 0
      ? supabase.from("visit_templates").select("id,name").in("id", templateIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const statusOptions = Array.from(
    new Set(visitsData.map((visit) => visit.status).filter(Boolean))
  ) as string[];
  const normalizedStatusOptions = selectedStatus
    ? Array.from(new Set([selectedStatus, ...statusOptions]))
    : statusOptions;

  const buildingNameById = new Map(
    (buildingsResult.data ?? []).map((building) => [building.id, building.name])
  );
  const templateNameById = new Map(
    (templatesResult.data ?? []).map((template) => [template.id, template.name])
  );

  const buildingOptions = Array.from(new Set(buildingIds)).map((id) => ({
    id,
    name: buildingNameById.get(id) ?? "—",
  }));

  if (selectedBuilding && !buildingOptions.some((building) => building.id === selectedBuilding)) {
    buildingOptions.push({ id: selectedBuilding, name: "—" });
  }

  if (visitsErr) {
    console.error("Tech history visits error:", visitsErr);
  }
  if (buildingsResult.error) {
    console.error("Tech history buildings error:", buildingsResult.error);
  }
  if (templatesResult.error) {
    console.error("Tech history templates error:", templatesResult.error);
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/tech/today" className="text-sm text-gray-500">
          ← Volver a hoy
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Historial</h1>
        <p className="text-gray-600">Tus visitas anteriores</p>
      </div>

      <form className="mb-6 flex flex-wrap items-end gap-4" method="get">
        <div>
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select
            name="status"
            defaultValue={selectedStatus}
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Todos</option>
            {normalizedStatusOptions.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Building</label>
          <select
            name="building"
            defaultValue={selectedBuilding}
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Todos</option>
            {buildingOptions.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded border px-4 py-2">
          Filtrar
        </button>
        <Link href="/tech/history" className="rounded border px-4 py-2 text-gray-700">
          Limpiar
        </Link>
      </form>

      {visitsErr ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando visitas: {visitsErr.message}
        </div>
      ) : null}
      {buildingsResult.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando buildings: {buildingsResult.error.message}
        </div>
      ) : null}
      {templatesResult.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando templates: {templatesResult.error.message}
        </div>
      ) : null}

      {visitsData.length === 0 ? (
        <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          0 VISITS for userId {userId || "—"}
        </div>
      ) : null}

      <div className="space-y-3">
        {visitsData.map((visit) => (
          <div key={visit.id} className="rounded border p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{formatDateOnlyLabel(visit.scheduled_for)}</span>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                {formatStatus(visit.status)}
              </span>
            </div>
            <div className="mt-2 text-gray-600">
              Building: {visit.building_id ? buildingNameById.get(visit.building_id) ?? "—" : "—"}
            </div>
            <div className="text-gray-600">
              Formulario: {visit.template_id ? templateNameById.get(visit.template_id) ?? "—" : "—"}
            </div>
            <div className="text-gray-600">Completado: {safeFormatDate(visit.completed_at)}</div>
            <div className="mt-2">
              <Link
                href={`/tech/visits/${visit.id}`}
                className="text-blue-600 hover:underline"
              >
                Ver →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
