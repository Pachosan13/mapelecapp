import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateOnlyLabel } from "@/lib/dates/dateOnly";
import { getCrewsWithDisplay } from "@/lib/crews/withMembers";
import DailyCrewBoard from "./DailyCrewBoard";
import { panamaDay } from "@/lib/dates/panamaDay";

type SearchParams = {
  date?: string;
};

const DAY_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type Visit = {
  id: string;
  status: string | null;
  scheduled_for: string;
  assigned_crew_id: string | null;
  assigned_tech_user_id: string | null;
  building_id: string | null;
  template_id: string | null;
};

export default async function OpsDailyBoardPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = (await createClient()).schema("public");
  const today = panamaDay();
  const dateParam = searchParams?.date?.trim();
  const selectedDate =
    dateParam && DAY_PARAM_PATTERN.test(dateParam) ? dateParam : today;

  const [crewsResult, techsResult, visitsResult] = await Promise.all([
    supabase.from("crews").select("id,name").order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("user_id,full_name,home_crew_id,created_at")
      .eq("role", "tech")
      .eq("is_active", true),
    supabase
      .from("visits")
      .select(
        "id,status,scheduled_for,assigned_crew_id,assigned_tech_user_id,building_id,template_id"
      )
      .eq("scheduled_for", selectedDate)
      .order("scheduled_for", { ascending: true }),
  ]);

  const crewsRaw = crewsResult.data ?? [];
  const techs = (techsResult.data ?? []) as Array<{
    user_id: string;
    full_name: string | null;
    home_crew_id: string | null;
    created_at?: string | null;
  }>;
  const crews = getCrewsWithDisplay(crewsRaw, techs);
  const visits = (visitsResult.data ?? []) as Visit[];
  const boardVisits: Parameters<typeof DailyCrewBoard>[0]["visits"] = visits.map(
    (visit) => ({
      id: visit.id,
      status: visit.status,
      scheduled_for: visit.scheduled_for,
      assigned_crew_id: visit.assigned_crew_id,
      assigned_tech_user_id: visit.assigned_tech_user_id,
      building: visit.building_id
        ? {
            id: visit.building_id,
            name: `Building ${visit.building_id.slice(0, 8)}`,
          }
        : null,
      template: visit.template_id
        ? {
            id: visit.template_id,
            name: `Template ${visit.template_id.slice(0, 8)}`,
          }
        : null,
    })
  );
  const techById = new Map(
    techs.map((t) => [t.user_id, { full_name: t.full_name }])
  );
  const crewDisplayById = new Map(
    crews.map((c) => [c.id, { leader: c.leader, helper: c.helper }])
  );
  const hasError = Boolean(crewsResult.error || techsResult.error || visitsResult.error);

  return (
    <div className="min-h-screen bg-gray-50/40 p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/ops/visits" className="text-sm text-gray-500">
            ← Lista
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">
            Tablero del día
          </h1>
          <p className="text-sm text-gray-500">
            Reasigna visitas planeadas por técnico.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/ops/daily-board"
            className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
          >
            Hoy
          </Link>
          <div className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium">
            {formatDateOnlyLabel(selectedDate)}
          </div>
          <form method="get" className="flex items-center gap-2">
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              Ir
            </button>
          </form>
        </div>
      </div>

      {hasError ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando el board diario.
        </div>
      ) : null}

      <DailyCrewBoard
        crews={crews}
        visits={boardVisits}
        techById={techById}
        crewDisplayById={crewDisplayById}
      />
    </div>
  );
}
