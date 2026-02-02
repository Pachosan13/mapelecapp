import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  formatPanamaDateLabel,
  getPanamaTodayDateString,
} from "@/lib/dates/panama";
import DailyCrewBoard from "./DailyCrewBoard";

type SearchParams = {
  date?: string;
};

export default async function OpsDailyBoardPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = await createClient();
  const today = getPanamaTodayDateString();
  const selectedDate = searchParams?.date?.trim() || today;

  const [crewsResult, visitsResult] = await Promise.all([
    supabase.from("crews").select("id,name").order("name", { ascending: true }),
    supabase
      .from("visits")
      .select(
        "id,status,scheduled_for,assigned_crew_id,assigned_tech_user_id,building:buildings(id,name),template:visit_templates(id,name)"
      )
      .eq("scheduled_for", selectedDate)
      .order("scheduled_for", { ascending: true }),
  ]);

  const crews = crewsResult.data ?? [];
  const visits = visitsResult.data ?? [];
  const hasError = Boolean(crewsResult.error || visitsResult.error);

  return (
    <div className="min-h-screen bg-gray-50/40 p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/ops/visits" className="text-sm text-gray-500">
            ← Lista
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">
            Hoy por cuadrillas
          </h1>
          <p className="text-sm text-gray-500">
            Reasigna visitas planeadas por crew.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium">
            {formatPanamaDateLabel(selectedDate)}
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

      <DailyCrewBoard crews={crews} visits={visits} />
    </div>
  );
}
