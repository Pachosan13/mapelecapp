import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { formatPanamaDateLabel } from "@/lib/dates/panama";
import { formatDateOnlyLabel } from "@/lib/dates/dateOnly";

type VisitStatus = NonNullable<Database["public"]["Tables"]["visits"]["Row"]["status"]>;

type SearchParams = {
  status?: string;
  tech?: string;
};

const ALLOWED_STATUS_SET = new Set<string>(["planned", "in_progress", "completed"]);

function toVisitStatus(value: string | undefined | null): VisitStatus | null {
  if (!value) return null;
  return ALLOWED_STATUS_SET.has(value) ? (value as VisitStatus) : null;
}

const formatStatus = (status?: string | null) => {
  if (!status) return "Scheduled";
  return status.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
};

export default async function BuildingHistoryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  const supabase = (await createClient()).schema("public");
  const currentUser = await getCurrentUser();
  const canAccessServiceReport =
    currentUser?.role === "ops_manager" || currentUser?.role === "director";
  const selectedStatus = searchParams?.status?.trim() ?? "";
  const selectedTech = searchParams?.tech?.trim() ?? "";

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

  const visitsQuery = supabase
    .from("visits")
    .select(
      "id,scheduled_for,status,assigned_tech_user_id,template_id,started_at,completed_at,created_at,template:visit_templates(id,name)"
    )
    .eq("building_id", params.id)
    .order("scheduled_for", { ascending: false })
    .order("created_at", { ascending: false });

  const statusTyped = toVisitStatus(selectedStatus);
  if (statusTyped) {
    visitsQuery.eq("status", statusTyped);
  }

  if (selectedTech) {
    visitsQuery.eq("assigned_tech_user_id", selectedTech);
  }

  const [visitsResult, techsResult] = await Promise.all([
    visitsQuery,
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
    status: string | null;
    assigned_tech_user_id: string | null;
    template_id: string | null;
    template: { id: string; name: string } | null;
    started_at: string | null;
    completed_at: string | null;
  }>;

  const hasError = visitsResult.error || techsResult.error;
  const techOptions = techsResult.data ?? [];

  const techIds = Array.from(
    new Set(visits.map((visit) => visit.assigned_tech_user_id).filter(Boolean))
  ) as string[];

  const [techProfilesResult] = await Promise.all([
    techIds.length > 0
      ? supabase.from("profiles").select("user_id,full_name").in("user_id", techIds)
      : Promise.resolve({ data: [] }),
  ]);

  const techNameById = new Map(
    (techProfilesResult.data ?? []).map((tech) => [tech.user_id, tech.full_name])
  );
  const statusOptions = Array.from(
    new Set(visits.map((visit) => visit.status).filter(Boolean))
  ) as string[];
  const normalizedStatusOptions = selectedStatus
    ? Array.from(new Set([selectedStatus, ...statusOptions]))
    : statusOptions;

  const formatTechName = (userId: string | null) => {
    if (!userId) {
      return "—";
    }
    return techNameById.get(userId) || `Usuario ${userId.slice(0, 6)}`;
  };

  const formatTemplateName = (visit: {
    template: { id: string; name: string } | null;
    template_id: string | null;
  }) => {
    if (visit.template?.name) {
      return visit.template.name;
    }
    if (visit.template_id) {
      return `Template ${visit.template_id.slice(0, 8)}`;
    }
    return "Formulario";
  };

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/buildings" className="text-sm text-gray-500">
          ← Volver a edificios
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{building.name}</h1>
            <p className="text-gray-600">Historial del building</p>
          </div>
          {canAccessServiceReport ? (
            <Link
              href={`/ops/buildings/${params.id}/service-report`}
              className="rounded border px-4 py-2 text-sm"
            >
              Reporte del día
            </Link>
          ) : null}
        </div>
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
          <label className="mb-1 block text-sm font-medium">Tech</label>
          <select
            name="tech"
            defaultValue={selectedTech}
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Todos</option>
            {techOptions.map((tech) => (
              <option key={tech.user_id} value={tech.user_id}>
                {tech.full_name?.trim() || `Usuario ${tech.user_id.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded border px-4 py-2">
          Filtrar
        </button>
        <Link
          href={`/ops/buildings/${params.id}/history`}
          className="rounded border px-4 py-2 text-gray-700"
        >
          Limpiar
        </Link>
      </form>

      {hasError ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando historial.
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Tech</th>
              <th className="px-4 py-3 font-medium">Formulario</th>
              <th className="px-4 py-3 font-medium">Inicio</th>
              <th className="px-4 py-3 font-medium">Completado</th>
              <th className="px-4 py-3 font-medium">Reporte</th>
            </tr>
          </thead>
          <tbody>
            {visits.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={7}>
                  No hay visitas registradas para este building.
                </td>
              </tr>
            ) : (
              visits.map((visit) => (
                <tr key={visit.id} className="border-t">
                  <td className="px-4 py-3">
                    {formatDateOnlyLabel(visit.scheduled_for)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                      {formatStatus(visit.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatTechName(visit.assigned_tech_user_id)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatTemplateName(visit)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {visit.started_at ? formatPanamaDateLabel(visit.started_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {visit.completed_at
                      ? formatPanamaDateLabel(visit.completed_at)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/ops/visits/${visit.id}/report`}
                      className="text-blue-600 hover:underline"
                    >
                      Ver reporte →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
