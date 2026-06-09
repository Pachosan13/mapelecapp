import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import DashboardTabs from "./DashboardTabs";

const PANAMA_TIME_ZONE = "America/Panama";

// Service cycle thresholds (days since last completed inspection).
const CYCLE_OK = 30; // al día
const CYCLE_WARN = 60; // atención · vencido > 60

// Days an in-progress visit can sit before it's flagged as stuck.
const STUCK_AFTER_DAYS = 7;

function panamaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PANAMA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export default async function DirectorDashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "director") redirect("/login");

  const supabase = (await createClient()).schema("public");

  const [visitsRes, buildingsRes, crewsRes, templatesRes, reportsRes, profilesRes] =
    await Promise.all([
      supabase
        .from("visits")
        .select(
          "id,status,scheduled_for,completed_at,updated_at,building_id,assigned_crew_id,template_id,building:buildings(id,name),crew:crews(id,name,category),template:visit_templates(id,name)"
        )
        .order("scheduled_for", { ascending: false }),
      supabase.from("buildings").select("id,name,systems,address"),
      supabase.from("crews").select("id,name,category"),
      supabase.from("visit_templates").select("id,name"),
      supabase
        .from("service_reports")
        .select("id,building_id,status,report_date,sent_at,building:buildings(id,name)")
        .order("report_date", { ascending: false }),
      supabase.from("profiles").select("role,is_active"),
    ]);

  const visits = (visitsRes.data ?? []) as Array<{
    id: string;
    status: string;
    scheduled_for: string;
    completed_at: string | null;
    updated_at: string | null;
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
    address: string | null;
  }>;

  const crews = (crewsRes.data ?? []) as Array<{
    id: string;
    name: string;
    category: string;
  }>;

  const templates = (templatesRes.data ?? []) as Array<{ id: string; name: string }>;

  const reports = (reportsRes.data ?? []) as Array<{
    id: string;
    building_id: string;
    status: string;
    report_date: string;
    sent_at: string | null;
    building: { id: string; name: string } | null;
  }>;

  const profiles = (profilesRes.data ?? []) as Array<{
    role: string;
    is_active: boolean | null;
  }>;

  const today = panamaToday();

  // ── Per-building service status (the core compliance lens) ──
  const lastCompletedByBuilding = new Map<string, string>();
  const visitCountByBuilding = new Map<string, number>();
  const openByBuilding = new Map<string, number>();
  for (const v of visits) {
    if (!v.building_id) continue;
    visitCountByBuilding.set(
      v.building_id,
      (visitCountByBuilding.get(v.building_id) ?? 0) + 1
    );
    if (v.status === "in_progress") {
      openByBuilding.set(v.building_id, (openByBuilding.get(v.building_id) ?? 0) + 1);
    }
    if (v.completed_at) {
      const d = v.completed_at.slice(0, 10);
      const prev = lastCompletedByBuilding.get(v.building_id);
      if (!prev || d > prev) lastCompletedByBuilding.set(v.building_id, d);
    }
  }

  type BuildingRisk = {
    id: string;
    name: string;
    systems: string[];
    last_visit: string | null;
    days_since: number | null;
    open_visits: number;
    visit_count: number;
    risk: "ok" | "warn" | "overdue" | "none";
  };

  const buildingRisk: BuildingRisk[] = buildings.map((b) => {
    const last = lastCompletedByBuilding.get(b.id) ?? null;
    const days = last ? daysBetween(last, today) : null;
    let risk: BuildingRisk["risk"];
    if (days === null) risk = "none";
    else if (days <= CYCLE_OK) risk = "ok";
    else if (days <= CYCLE_WARN) risk = "warn";
    else risk = "overdue";
    return {
      id: b.id,
      name: b.name,
      systems: b.systems ?? [],
      last_visit: last,
      days_since: days,
      open_visits: openByBuilding.get(b.id) ?? 0,
      visit_count: visitCountByBuilding.get(b.id) ?? 0,
      risk,
    };
  });

  const overdueBuildings = buildingRisk.filter(
    (b) => b.risk === "overdue" || b.risk === "none"
  ).length;
  const buildingsUpToDate = buildingRisk.filter((b) => b.risk === "ok").length;

  // ── Stuck visits (in_progress sitting too long) ──
  const stuckVisits = visits
    .filter((v) => v.status === "in_progress")
    .map((v) => {
      const started = (v.updated_at ?? v.scheduled_for)?.slice(0, 10) ?? today;
      return {
        id: v.id,
        building_name: v.building?.name ?? "—",
        crew_name: v.crew?.name ?? "Sin asignar",
        template_name: v.template?.name ?? "—",
        since: v.scheduled_for,
        days_open: daysBetween(started, today),
      };
    })
    .sort((a, b) => b.days_open - a.days_open);

  const stuckCount = stuckVisits.length;
  const oldestStuck = stuckVisits[0]?.days_open ?? 0;

  // ── Reports pipeline ──
  const reportRows = reports.map((r) => ({
    id: r.id,
    building_name: r.building?.name ?? "—",
    report_date: r.report_date,
    status: r.status,
  }));
  const unsentReports = reports.filter((r) => r.status !== "sent").length;
  const sentReports = reports.filter((r) => r.status === "sent").length;

  // ── Historical compliance (completed vs all resolved) ──
  const completedAll = visits.filter((v) => v.status === "completed").length;
  const missedAll = visits.filter((v) => v.status === "missed").length;
  const resolved = completedAll + missedAll;
  const complianceRate = resolved > 0 ? Math.round((completedAll / resolved) * 100) : 0;

  // ── Activity recency ──
  const lastActivity =
    Array.from(lastCompletedByBuilding.values()).sort().slice(-1)[0] ?? null;
  const daysSinceActivity = lastActivity ? daysBetween(lastActivity, today) : null;

  // ── Crew performance ──
  const crewMap = new Map<
    string,
    { completed: number; in_progress: number; planned: number; missed: number }
  >();
  for (const c of crews) {
    crewMap.set(c.id, { completed: 0, in_progress: 0, planned: 0, missed: 0 });
  }
  for (const v of visits) {
    if (!v.assigned_crew_id) continue;
    const entry = crewMap.get(v.assigned_crew_id);
    if (!entry) continue;
    if (v.status === "completed") entry.completed++;
    else if (v.status === "in_progress") entry.in_progress++;
    else if (v.status === "planned") entry.planned++;
    else if (v.status === "missed") entry.missed++;
  }
  const tabCrews = crews.map((c) => {
    const s = crewMap.get(c.id) ?? {
      completed: 0,
      in_progress: 0,
      planned: 0,
      missed: 0,
    };
    return { name: c.name, category: c.category, ...s };
  });

  // ── Operations table (all visits, newest first, capped) ──
  const tabVisits = visits.slice(0, 60).map((v) => ({
    id: v.id,
    status: v.status,
    scheduled_for: v.scheduled_for,
    completed_at: v.completed_at,
    building_name: v.building?.name ?? "—",
    crew_name: v.crew?.name ?? "Sin asignar",
    template_name: v.template?.name ?? "—",
  }));

  const activeTechs = profiles.filter(
    (p) => p.role === "tech" && p.is_active
  ).length;

  const complianceColor =
    complianceRate >= 90
      ? "text-emerald-600"
      : complianceRate >= 75
        ? "text-amber-600"
        : "text-red-600";

  // Alerts (only show those that fire)
  const alerts: Array<{ tone: "red" | "amber"; text: string; cta: string }> = [];
  if (stuckCount > 0)
    alerts.push({
      tone: "red",
      text: `${stuckCount} ${stuckCount === 1 ? "visita lleva" : "visitas llevan"} en progreso sin cerrar${
        oldestStuck > 0 ? ` — la más antigua hace ${oldestStuck} días` : ""
      }.`,
      cta: "Operaciones",
    });
  if (overdueBuildings > 0)
    alerts.push({
      tone: "red",
      text: `${overdueBuildings} de ${buildings.length} edificios sin inspección registrada en más de ${CYCLE_WARN} días.`,
      cta: "Riesgo",
    });
  if (unsentReports > 0)
    alerts.push({
      tone: "amber",
      text: `${unsentReports} ${unsentReports === 1 ? "reporte está listo pero no se ha enviado" : "reportes están listos pero no se han enviado"} al cliente.`,
      cta: "Reportes",
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero header */}
      <div className="bg-navy-700 px-6 pb-24 pt-8 md:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
            Centro de Control · SEMCO
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">
            Estado Operativo
          </h1>
          <p className="mt-1 text-sm text-navy-300">
            {buildings.length} edificios &middot; {crews.length} crews &middot;{" "}
            {activeTechs} técnicos activos &middot; {visits.length} visitas en sistema
            {lastActivity ? (
              <>
                {" "}
                &middot; última actividad {lastActivity}
                {daysSinceActivity !== null && daysSinceActivity > 0
                  ? ` (hace ${daysSinceActivity}d)`
                  : ""}
              </>
            ) : null}
          </p>
        </div>
      </div>

      {/* KPI Cards — pulled up into the header */}
      <div className="mx-auto -mt-16 max-w-6xl px-6 md:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Edificios vencidos */}
          <KpiCard
            label="Edificios Vencidos"
            value={overdueBuildings}
            suffix={`/${buildings.length}`}
            hint={`al día: ${buildingsUpToDate} · ciclo ${CYCLE_WARN}d`}
            tone={overdueBuildings > 0 ? "red" : "ok"}
          />
          {/* Visitas trancadas */}
          <KpiCard
            label="Visitas Trancadas"
            value={stuckCount}
            hint={
              stuckCount > 0
                ? `en progreso · más vieja ${oldestStuck}d`
                : "todo cerrado"
            }
            tone={stuckCount > 0 ? "red" : "ok"}
          />
          {/* Reportes sin enviar */}
          <KpiCard
            label="Reportes Sin Enviar"
            value={unsentReports}
            hint={`${sentReports} enviados · ${reports.length} totales`}
            tone={unsentReports > 0 ? "amber" : "ok"}
          />
          {/* Cumplimiento */}
          <div className="rounded-xl bg-white p-5 shadow-lg shadow-navy-700/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Cumplimiento
            </p>
            <p className={`mt-3 text-4xl font-black tabular-nums ${complianceColor}`}>
              {complianceRate}
              <span className="text-lg font-semibold">%</span>
            </p>
            <p className="mt-2 text-xs text-gray-400">
              {completedAll} completadas · {missedAll} perdidas
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mx-auto mt-6 max-w-6xl px-6 md:px-8">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50/80 px-5 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-navy-500">
                Requiere Atención
              </p>
            </div>
            <ul className="divide-y divide-gray-50">
              {alerts.map((a, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                      a.tone === "red" ? "bg-red-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="text-sm text-gray-700">{a.text}</span>
                  <span className="ml-auto hidden shrink-0 rounded-full bg-navy-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy-500 sm:inline-block">
                    {a.cta}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Tabs Section */}
      <div className="mx-auto mt-8 max-w-6xl px-6 pb-12 md:px-8">
        <DashboardTabs
          visits={tabVisits}
          buildings={buildingRisk}
          crews={tabCrews}
          reports={reportRows}
          stuck={stuckVisits}
          cycleOk={CYCLE_OK}
          cycleWarn={CYCLE_WARN}
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  suffix,
  hint,
  tone,
}: {
  label: string;
  value: number;
  suffix?: string;
  hint: string;
  tone: "red" | "amber" | "ok";
}) {
  const valueColor =
    tone === "red"
      ? "text-red-600"
      : tone === "amber"
        ? "text-amber-600"
        : "text-navy-700";
  const ring =
    tone === "red"
      ? "ring-2 ring-red-400/20"
      : tone === "amber"
        ? "ring-2 ring-amber-400/20"
        : "";
  return (
    <div className={`rounded-xl bg-white p-5 shadow-lg shadow-navy-700/5 ${ring}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
        {label}
      </p>
      <p className={`mt-3 text-4xl font-black tabular-nums ${valueColor}`}>
        {value}
        {suffix ? (
          <span className="text-lg font-normal text-gray-300">{suffix}</span>
        ) : null}
      </p>
      <p className="mt-2 text-xs text-gray-400">{hint}</p>
    </div>
  );
}
