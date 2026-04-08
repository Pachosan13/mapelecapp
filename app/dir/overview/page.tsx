import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import DashboardTabs from "./DashboardTabs";

export default async function DirectorDashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "director") redirect("/login");

  const supabase = (await createClient()).schema("public");

  const [visitsRes, buildingsRes, crewsRes, templatesRes, responsesRes, reportsRes] =
    await Promise.all([
      supabase
        .from("visits")
        .select(
          "id,status,scheduled_for,completed_at,building_id,assigned_crew_id,template_id,building:buildings(id,name),crew:crews(id,name,category),template:visit_templates(id,name)"
        )
        .order("scheduled_for", { ascending: false }),
      supabase.from("buildings").select("id,name,systems"),
      supabase.from("crews").select("id,name,category"),
      supabase.from("visit_templates").select("id,name"),
      supabase.from("visit_responses").select("id,visit_id").limit(1000),
      supabase.from("service_reports").select("id,building_id,status"),
    ]);

  const visits = (visitsRes.data ?? []) as Array<{
    id: string;
    status: string;
    scheduled_for: string;
    completed_at: string | null;
    building_id: string | null;
    assigned_crew_id: string | null;
    template_id: string | null;
    building: { id: string; name: string } | null;
    crew: { id: string; name: string; category: string } | null;
    template: { id: string; name: string } | null;
  }>;

  const buildings = (buildingsRes.data ?? []) as Array<{
    id: string;
    name: string;
    systems: string[] | null;
  }>;

  const crews = (crewsRes.data ?? []) as Array<{
    id: string;
    name: string;
    category: string;
  }>;

  const templates = (templatesRes.data ?? []) as Array<{
    id: string;
    name: string;
  }>;

  const responses = (responsesRes.data ?? []) as Array<{
    id: string;
    visit_id: string;
  }>;

  const reports = (reportsRes.data ?? []) as Array<{
    id: string;
    building_id: string;
    status: string;
  }>;

  // ── KPI calculations ──
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

  const recentVisits = visits.filter((v) => v.scheduled_for >= cutoff);
  const completedRecent = recentVisits.filter((v) => v.status === "completed");
  const scheduledRecent = recentVisits.filter((v) => v.status !== "missed");

  const complianceRate =
    scheduledRecent.length > 0
      ? Math.round((completedRecent.length / scheduledRecent.length) * 100)
      : 0;

  const today = now.toISOString().slice(0, 10);
  const todayVisits = visits.filter((v) => v.scheduled_for === today);
  const todayCompleted = todayVisits.filter((v) => v.status === "completed").length;

  const activeBuildingIds = new Set(
    recentVisits.map((v) => v.building_id).filter(Boolean)
  );

  const reportsCount = reports.length;

  const crewsToday = new Set(
    todayVisits.map((v) => v.assigned_crew_id).filter(Boolean)
  );

  // ── Tab data ──
  const tabVisits = recentVisits.map((v) => ({
    id: v.id,
    status: v.status,
    scheduled_for: v.scheduled_for,
    completed_at: v.completed_at,
    building_name: v.building?.name ?? "—",
    crew_name: v.crew?.name ?? "Sin asignar",
    template_name: v.template?.name ?? "—",
  }));

  const buildingMap = new Map<string, { count: number; lastVisit: string | null }>();
  for (const v of visits) {
    if (!v.building_id) continue;
    const entry = buildingMap.get(v.building_id) ?? { count: 0, lastVisit: null };
    entry.count++;
    if (v.completed_at && (!entry.lastVisit || v.completed_at > entry.lastVisit)) {
      entry.lastVisit = v.completed_at.slice(0, 10);
    }
    buildingMap.set(v.building_id, entry);
  }

  const tabBuildings = buildings.map((b) => {
    const stats = buildingMap.get(b.id);
    return {
      id: b.id,
      name: b.name,
      systems: b.systems ?? [],
      visit_count: stats?.count ?? 0,
      last_visit: stats?.lastVisit ?? null,
    };
  });

  const crewMap = new Map<string, { completed: number; in_progress: number; planned: number }>();
  for (const c of crews) {
    crewMap.set(c.id, { completed: 0, in_progress: 0, planned: 0 });
  }
  for (const v of visits) {
    if (!v.assigned_crew_id) continue;
    const entry = crewMap.get(v.assigned_crew_id);
    if (!entry) continue;
    if (v.status === "completed") entry.completed++;
    else if (v.status === "in_progress") entry.in_progress++;
    else if (v.status === "planned") entry.planned++;
  }

  const tabCrews = crews.map((c) => {
    const stats = crewMap.get(c.id) ?? { completed: 0, in_progress: 0, planned: 0 };
    return { name: c.name, category: c.category, ...stats };
  });

  const responsesByVisit = new Map<string, number>();
  for (const r of responses) {
    responsesByVisit.set(r.visit_id, (responsesByVisit.get(r.visit_id) ?? 0) + 1);
  }

  const tabTemplates = templates.map((t) => {
    const visitsUsing = visits.filter((v) => v.template_id === t.id);
    const totalResponses = visitsUsing.reduce(
      (sum, v) => sum + (responsesByVisit.get(v.id) ?? 0),
      0
    );
    return { name: t.name, visits_using: visitsUsing.length, total_responses: totalResponses };
  });

  // Compliance indicator
  const complianceColor =
    complianceRate >= 90
      ? "text-emerald-400"
      : complianceRate >= 75
        ? "text-amber-400"
        : "text-red-400";

  const complianceRing =
    complianceRate >= 90
      ? "ring-emerald-400/20"
      : complianceRate >= 75
        ? "ring-amber-400/20"
        : "ring-red-400/20";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero header */}
      <div className="bg-navy-700 px-6 pb-20 pt-8 md:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
            Director Dashboard
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            Centro de Control
          </h1>
          <p className="mt-1 text-sm text-navy-300">
            Últimos 30 días &middot; {buildings.length} edificios &middot;{" "}
            {crews.length} crews &middot; {visits.length} visitas totales
          </p>
        </div>
      </div>

      {/* KPI Cards — pulled up into the header */}
      <div className="mx-auto -mt-14 max-w-6xl px-6 md:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* 1. Compliance */}
          <div className={`rounded-xl bg-white p-5 shadow-lg shadow-navy-700/5 ring-2 ${complianceRing}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Compliance
            </p>
            <p className={`mt-3 text-4xl font-black tabular-nums ${complianceColor}`}>
              {complianceRate}
              <span className="text-lg font-semibold">%</span>
            </p>
            <p className="mt-2 text-xs text-gray-400">
              {completedRecent.length} de {scheduledRecent.length} visitas
            </p>
          </div>

          {/* 2. Visitas Hoy */}
          <div className="rounded-xl bg-white p-5 shadow-lg shadow-navy-700/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Visitas Hoy
            </p>
            <p className="mt-3 text-4xl font-black tabular-nums text-navy-700">
              {todayCompleted}
              <span className="text-lg font-normal text-gray-300">
                /{todayVisits.length}
              </span>
            </p>
            <p className="mt-2 text-xs text-gray-400">completadas / total</p>
          </div>

          {/* 3. Edificios Activos */}
          <div className="rounded-xl bg-white p-5 shadow-lg shadow-navy-700/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Edificios Activos
            </p>
            <p className="mt-3 text-4xl font-black tabular-nums text-navy-700">
              {activeBuildingIds.size}
              <span className="text-lg font-normal text-gray-300">
                /{buildings.length}
              </span>
            </p>
            <p className="mt-2 text-xs text-gray-400">con visitas en 30d</p>
          </div>

          {/* 4. Reportes */}
          <div className="rounded-xl bg-white p-5 shadow-lg shadow-navy-700/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Reportes
            </p>
            <p className="mt-3 text-4xl font-black tabular-nums text-navy-700">
              {reportsCount}
            </p>
            <p className="mt-2 text-xs text-gray-400">service reports</p>
          </div>

          {/* 5. Crews */}
          <div className="rounded-xl bg-white p-5 shadow-lg shadow-navy-700/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Crews Hoy
            </p>
            <p className="mt-3 text-4xl font-black tabular-nums text-navy-700">
              {crewsToday.size}
              <span className="text-lg font-normal text-gray-300">
                /{crews.length}
              </span>
            </p>
            <p className="mt-2 text-xs text-gray-400">en campo hoy</p>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="mx-auto mt-8 max-w-6xl px-6 pb-12 md:px-8">
        <DashboardTabs
          visits={tabVisits}
          buildings={tabBuildings}
          crews={tabCrews}
          templates={tabTemplates}
        />
      </div>
    </div>
  );
}
