import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatShortDateLabel } from "@/lib/dates/dateOnly";
import { panamaDay } from "@/lib/dates/panamaDay";
import { getCrewsWithDisplay } from "@/lib/crews/withMembers";
import { formatCrewLabel } from "@/lib/formatters/crewLabel";
import { fetchAllRows } from "@/lib/db/fetchAllRows";

export const dynamic = "force-dynamic";

const daysBetween = (from: string, to: string) => {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
};

/**
 * Visitas que quedaron en `in_progress`. Importa porque una visita que no llega a
 * `completed` no genera informe (ops/visits/[id]: canGenerateReport exige completed)
 * y sus hallazgos no salen en /ops/hallazgos (filtra por completed). O sea: trabajo
 * de campo hecho que nunca llega al cliente, y hallazgos de sistemas contra incendio
 * que quedan invisibles. Sin esta pantalla no había dónde verlas.
 */
export default async function VisitasAbiertasPage() {
  const supabase = await createClient();
  const today = panamaDay();

  const { data: visitsData, error } = await supabase
    .from("visits")
    .select(
      "id,building_id,scheduled_for,started_at,assigned_tech_user_id,assigned_crew_id,building:buildings(id,name),template:visit_templates(id,name)"
    )
    .eq("status", "in_progress")
    .order("scheduled_for", { ascending: true });

  const visits = (visitsData ?? []) as Array<{
    id: string;
    building_id: string | null;
    scheduled_for: string;
    started_at: string | null;
    assigned_tech_user_id: string | null;
    assigned_crew_id: string | null;
    building: { id: string; name: string } | null;
    template: { id: string; name: string } | null;
  }>;

  const visitIds = visits.map((visit) => visit.id);
  const techIds = Array.from(
    new Set(
      visits
        .map((visit) => visit.assigned_tech_user_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const [responsesResult, profilesResult, crewsResult, allTechsResult] =
    await Promise.all([
      visitIds.length > 0
        ? fetchAllRows<{ visit_id: string | null; item_id: string | null }>((desde, hasta) =>
            supabase
              .from("visit_latest_responses")
              .select("visit_id,item_id")
              .in("visit_id", visitIds)
              .range(desde, hasta)
          )
        : Promise.resolve({ data: [] }),
      techIds.length > 0
        ? supabase
            .from("profiles")
            .select("user_id,full_name")
            .in("user_id", techIds)
        : Promise.resolve({ data: [] }),
      supabase.from("crews").select("id,name"),
      supabase
        .from("profiles")
        .select("user_id,full_name,home_crew_id,created_at")
        .eq("role", "tech"),
    ]);

  const filledByVisit = new Map<string, number>();
  (responsesResult.data ?? []).forEach((row) => {
    if (!row.visit_id) return;
    filledByVisit.set(row.visit_id, (filledByVisit.get(row.visit_id) ?? 0) + 1);
  });
  const techNameById = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.user_id,
      profile.full_name?.trim() || "—",
    ])
  );
  const crewLabelById = new Map(
    getCrewsWithDisplay(
      crewsResult.data ?? [],
      (allTechsResult.data ?? []) as never
    ).map((crew) => [crew.id, formatCrewLabel(crew)])
  );

  const withWork = visits.filter((visit) => (filledByVisit.get(visit.id) ?? 0) > 0);
  const empty = visits.filter((visit) => (filledByVisit.get(visit.id) ?? 0) === 0);

  const renderRow = (visit: (typeof visits)[number], index: number) => {
    const filled = filledByVisit.get(visit.id) ?? 0;
    const days = daysBetween(visit.scheduled_for, today);
    return (
      <div
        key={visit.id}
        className={`flex flex-wrap items-center justify-between gap-4 px-5 py-4 ${
          index === 0 ? "" : "border-t border-gray-100"
        }`}
      >
        <div className="min-w-0">
          <div className="font-medium text-gray-900">
            {visit.building?.name ?? "—"}
          </div>
          <div className="mt-0.5 text-sm text-gray-500">
            {visit.template?.name ?? "Formulario"} ·{" "}
            {formatShortDateLabel(visit.scheduled_for)}
            {days > 0 ? ` · ${days} día${days === 1 ? "" : "s"} abierta` : ""}
          </div>
          <div className="mt-1 text-sm text-gray-500">
            {visit.assigned_tech_user_id
              ? techNameById.get(visit.assigned_tech_user_id) ?? "—"
              : visit.assigned_crew_id
                ? crewLabelById.get(visit.assigned_crew_id) ?? "Sin reclamar"
                : "Sin asignar"}
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-900">{filled}</div>
            <div className="text-xs text-gray-500">casillas llenas</div>
          </div>
          <Link
            href={`/ops/visits/${visit.id}`}
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Abrir →
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/dashboard" className="text-sm text-gray-500">
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Visitas abiertas</h1>
        <p className="mt-1 text-sm text-gray-600">
          Visitas iniciadas que nunca se completaron. Mientras estén así no
          generan informe y sus hallazgos no aparecen en la pantalla de
          hallazgos.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando visitas: {error.message}
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-6 rounded border p-4 text-sm">
        <div>
          <div className="text-xs uppercase text-gray-500">Abiertas</div>
          <div className="text-xl font-semibold text-gray-900">
            {visits.length}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-gray-500">Con trabajo</div>
          <div className="text-xl font-semibold text-amber-700">
            {withWork.length}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-gray-500">Sin nada llenado</div>
          <div className="text-xl font-semibold text-gray-500">
            {empty.length}
          </div>
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-gray-900">
        Con trabajo adentro ({withWork.length})
      </h2>
      <p className="mb-3 text-sm text-gray-500">
        Estas tienen respuestas guardadas. Revisar qué falta para cerrarlas.
      </p>
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white">
        {withWork.length === 0 ? (
          <div className="px-5 py-8 text-sm text-gray-500">Ninguna.</div>
        ) : (
          withWork.map(renderRow)
        )}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-gray-900">
        Sin nada llenado ({empty.length})
      </h2>
      <p className="mb-3 text-sm text-gray-500">
        Arranques en falso: alguien dio Iniciar y no llenó nada.
      </p>
      <div className="rounded-2xl border border-gray-100 bg-white">
        {empty.length === 0 ? (
          <div className="px-5 py-8 text-sm text-gray-500">Ninguna.</div>
        ) : (
          empty.map(renderRow)
        )}
      </div>
    </div>
  );
}
