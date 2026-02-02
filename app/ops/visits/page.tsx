import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import OpsVisitsToast from "./OpsVisitsToast";
import {
  formatPanamaDateLabel,
  getPanamaDayRange,
  getPanamaTodayDateString,
} from "@/lib/dates/panama";

type SearchParams = {
  date?: string;
  tech?: string;
  building?: string;
  success?: string;
};

const shiftDate = (dateString: string, days: number) => {
  const parsed = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return dateString;
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const formatStatus = (status?: string) => {
  if (!status) return "Scheduled";
  return status.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
};

const buildAgendaUrl = (date: string, tech?: string, building?: string) => {
  const params = new URLSearchParams();
  params.set("date", date);
  if (tech) params.set("tech", tech);
  if (building) params.set("building", building);
  return `/ops/visits?${params.toString()}`;
};

export default async function OpsVisitsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = await createClient();
  const today = getPanamaTodayDateString();
  const selectedDate = searchParams?.date?.trim() || today;
  const selectedTech = searchParams?.tech?.trim() || "";
  const selectedBuilding = searchParams?.building?.trim() || "";

  const { data: scheduledForSample } = await supabase
    .from("visits")
    .select("scheduled_for")
    .limit(1);

  const scheduledForValue = scheduledForSample?.[0]?.scheduled_for;
  const scheduledForIsTimestamp =
    typeof scheduledForValue === "string" && scheduledForValue.includes("T");

  const visitsQuery = supabase
    .from("visits")
    .select(
      "id,scheduled_for,status,building_id,assigned_tech_user_id,building:buildings(id,name),template:visit_templates(id,name)"
    )
    .order("scheduled_for", { ascending: true })
    .limit(100);

  if (scheduledForIsTimestamp) {
    const range = getPanamaDayRange(selectedDate);
    if (range) {
      visitsQuery.gte("scheduled_for", range.start).lt("scheduled_for", range.end);
    } else {
      visitsQuery.eq("scheduled_for", selectedDate);
    }
  } else {
    visitsQuery.eq("scheduled_for", selectedDate);
  }

  if (selectedTech) {
    visitsQuery.eq("assigned_tech_user_id", selectedTech);
  }

  if (selectedBuilding) {
    visitsQuery.eq("building_id", selectedBuilding);
  }

  const [visitsResult, buildingsResult, techsResult] = await Promise.all([
    visitsQuery,
    supabase.from("buildings").select("id,name").order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("user_id,full_name,is_active")
      .eq("role", "tech")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);

  const visits = (visitsResult.data ?? []) as Array<{
    id: string;
    scheduled_for: string;
    status?: string | null;
    building_id: string | null;
    assigned_tech_user_id: string | null;
    building: { id: string; name: string } | null;
    template: { id: string; name: string } | null;
  }>;

  const buildingOptions = buildingsResult.data ?? [];
  const techOptions = techsResult.data ?? [];

  const techIds = Array.from(
    new Set(visits.map((visit) => visit.assigned_tech_user_id).filter(Boolean))
  ) as string[];

  const { data: visitTechs } =
    techIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id,full_name")
          .in("user_id", techIds)
      : { data: [] };

  const techNameById = new Map(
    (visitTechs ?? []).map((tech) => [tech.user_id, tech.full_name])
  );

  const missingTechIds = techIds.filter((id) => !techNameById.has(id));
  if (missingTechIds.length > 0) {
    console.warn(
      `[ops/visits] Missing tech profiles for ids: ${missingTechIds.join(", ")}`
    );
  }

  const hasError = visitsResult.error || buildingsResult.error || techsResult.error;
  const prevDate = shiftDate(selectedDate, -1);
  const nextDate = shiftDate(selectedDate, 1);

  return (
    <div className="min-h-screen bg-gray-50/40 p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hoy</h1>
          <p className="text-sm text-gray-500">Visitas programadas</p>
        </div>
        <Link
          href="/ops/visits/new"
          className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Nueva visita
        </Link>
      </div>

      <OpsVisitsToast message={searchParams?.success} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href={buildAgendaUrl(prevDate, selectedTech, selectedBuilding)}
          className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          ← Prev
        </Link>
        <div className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800">
          {formatPanamaDateLabel(selectedDate)}
        </div>
        <Link
          href={buildAgendaUrl(nextDate, selectedTech, selectedBuilding)}
          className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          Next →
        </Link>
        <div className="ml-auto inline-flex rounded-full border border-gray-200 bg-white p-1 text-xs text-gray-600">
          <Link
            href="/ops/visits"
            className="rounded-full bg-gray-900 px-3 py-1 font-semibold text-white"
          >
            Lista
          </Link>
          <Link
            href="/ops/daily-board"
            className="rounded-full px-3 py-1 font-medium text-gray-600 hover:text-gray-900"
          >
            Cuadrillas
          </Link>
        </div>
      </div>

      <form className="mb-8 flex flex-wrap items-end gap-4" method="get">
        <input type="hidden" name="date" value={selectedDate} />
        <div>
          <label className="mb-1 block text-sm font-medium">Tech</label>
          <select
            name="tech"
            defaultValue={selectedTech}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {techOptions.map((tech) => (
              <option key={tech.user_id} value={tech.user_id}>
                {tech.full_name?.trim() || `Usuario ${tech.user_id.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Building</label>
          <select
            name="building"
            defaultValue={selectedBuilding}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {buildingOptions.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm"
        >
          Filtrar
        </button>
        <Link
          href={buildAgendaUrl(selectedDate)}
          className="rounded-full px-4 py-2 text-sm text-gray-600 hover:bg-white"
        >
          Limpiar
        </Link>
      </form>

      {hasError ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando agenda de visitas.
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50/70 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Building</th>
              <th className="px-4 py-3 font-medium">Tech</th>
              <th className="px-4 py-3 font-medium">Formulario</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visits.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={6}>
                  No hay visitas para este dia y filtros.
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

                return (
                  <tr key={visit.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      {formatPanamaDateLabel(visit.scheduled_for)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {visit.building ? (
                        <Link
                          href={`/ops/buildings/${visit.building.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {visit.building.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{techName}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {visit.template?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-xs text-gray-500">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            visit.status === "planned"
                              ? "bg-gray-300"
                              : visit.status === "in_progress"
                                ? "bg-blue-400"
                                : visit.status === "completed"
                                  ? "bg-emerald-400"
                                  : "bg-gray-300"
                          }`}
                        />
                        {formatStatus(visit.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {visit.building ? (
                        <Link
                          href={`/ops/buildings/${visit.building.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          View building history →
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
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
