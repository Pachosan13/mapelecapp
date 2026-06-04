"use client";

import { useState } from "react";

type Visit = {
  id: string;
  status: string;
  scheduled_for: string;
  completed_at: string | null;
  building_name: string;
  crew_name: string;
  template_name: string;
};

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

type CrewPerf = {
  name: string;
  category: string;
  completed: number;
  in_progress: number;
  planned: number;
  missed: number;
};

type ReportRow = {
  id: string;
  building_name: string;
  report_date: string;
  status: string;
};

type StuckVisit = {
  id: string;
  building_name: string;
  crew_name: string;
  template_name: string;
  since: string;
  days_open: number;
};

interface DashboardTabsProps {
  visits: Visit[];
  buildings: BuildingRisk[];
  crews: CrewPerf[];
  reports: ReportRow[];
  stuck: StuckVisit[];
  cycleOk: number;
  cycleWarn: number;
}

const tabs = [
  { key: "risk", label: "Riesgo" },
  { key: "ops", label: "Operaciones" },
  { key: "perf", label: "Crews" },
  { key: "reports", label: "Reportes" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  completed: { label: "Completada", bg: "bg-emerald-50", text: "text-emerald-700" },
  in_progress: { label: "En Progreso", bg: "bg-amber-50", text: "text-amber-700" },
  planned: { label: "Planificada", bg: "bg-navy-50", text: "text-navy-600" },
  missed: { label: "Perdida", bg: "bg-red-50", text: "text-red-700" },
};

const reportStatusConfig: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  draft: { label: "Borrador", bg: "bg-gray-100", text: "text-gray-600" },
  ready: { label: "Listo", bg: "bg-amber-50", text: "text-amber-700" },
  sent: { label: "Enviado", bg: "bg-emerald-50", text: "text-emerald-700" },
};

const riskConfig: Record<
  BuildingRisk["risk"],
  { label: string; bg: string; text: string; dot: string }
> = {
  ok: { label: "Al día", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  warn: { label: "Atención", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  overdue: { label: "Vencido", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  none: { label: "Sin registro", bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
};

function SystemBadges({ systems }: { systems: string[] }) {
  return (
    <div className="flex gap-1.5">
      {systems.map((s) => (
        <span
          key={s}
          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            s === "pump" ? "bg-blue-50 text-blue-600" : "bg-gold-50 text-gold-600"
          }`}
        >
          {s === "pump" ? "Bomba" : "Incendio"}
        </span>
      ))}
    </div>
  );
}

export default function DashboardTabs({
  visits,
  buildings,
  crews,
  reports,
  stuck,
  cycleOk,
  cycleWarn,
}: DashboardTabsProps) {
  const [active, setActive] = useState<TabKey>("risk");

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 inline-flex rounded-lg border border-navy-100 bg-white p-1 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`rounded-md px-5 py-2 text-sm font-semibold transition-all ${
              active === t.key
                ? "bg-navy-700 text-white shadow-md"
                : "text-navy-400 hover:text-navy-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg shadow-navy-700/5">
        {active === "risk" && (
          <RiskTab buildings={buildings} cycleOk={cycleOk} cycleWarn={cycleWarn} />
        )}
        {active === "ops" && <OpsTab visits={visits} stuck={stuck} />}
        {active === "perf" && <PerfTab crews={crews} />}
        {active === "reports" && <ReportsTab reports={reports} />}
      </div>
    </div>
  );
}

/* ── Riesgo por edificio ── */
function RiskTab({
  buildings,
  cycleOk,
  cycleWarn,
}: {
  buildings: BuildingRisk[];
  cycleOk: number;
  cycleWarn: number;
}) {
  const rank: Record<BuildingRisk["risk"], number> = {
    overdue: 0,
    none: 1,
    warn: 2,
    ok: 3,
  };
  const sorted = [...buildings].sort((a, b) => {
    if (rank[a.risk] !== rank[b.risk]) return rank[a.risk] - rank[b.risk];
    return (b.days_since ?? 9999) - (a.days_since ?? 9999);
  });

  return (
    <div className="overflow-x-auto">
      <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-2.5 text-[11px] text-gray-500">
        Al día ≤ {cycleOk}d · Atención {cycleOk + 1}–{cycleWarn}d · Vencido &gt; {cycleWarn}d
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            <Th>Edificio</Th>
            <Th>Sistemas</Th>
            <Th>Última Inspección</Th>
            <Th right>Días</Th>
            <Th right>Abiertas</Th>
            <Th>Estado</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => {
            const rc = riskConfig[b.risk];
            return (
              <tr
                key={b.id}
                className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/50"
              >
                <td className="px-5 py-3.5 font-semibold text-navy-700">{b.name}</td>
                <td className="px-5 py-3.5">
                  <SystemBadges systems={b.systems} />
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-gray-500">
                  {b.last_visit ?? "—"}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span
                    className={`font-mono text-sm font-bold ${
                      b.risk === "overdue"
                        ? "text-red-600"
                        : b.risk === "warn"
                          ? "text-amber-600"
                          : "text-gray-500"
                    }`}
                  >
                    {b.days_since ?? "—"}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  {b.open_visits > 0 ? (
                    <span className="font-mono text-sm font-bold text-amber-600">
                      {b.open_visits}
                    </span>
                  ) : (
                    <span className="text-gray-300">0</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${rc.bg} ${rc.text}`}
                  >
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${rc.dot}`} />
                    {rc.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Operaciones ── */
function OpsTab({ visits, stuck }: { visits: Visit[]; stuck: StuckVisit[] }) {
  const stuckIds = new Set(stuck.map((s) => s.id));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            <Th>Fecha</Th>
            <Th>Edificio</Th>
            <Th>Template</Th>
            <Th>Crew</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {visits.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                Sin visitas registradas.
              </td>
            </tr>
          ) : (
            visits.map((v) => {
              const s = statusConfig[v.status] ?? statusConfig.planned;
              const isStuck = stuckIds.has(v.id);
              return (
                <tr
                  key={v.id}
                  className={`border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/50 ${
                    isStuck ? "bg-amber-50/40" : ""
                  }`}
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500">
                    {v.scheduled_for}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-navy-700">
                    {v.building_name}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{v.template_name}</td>
                  <td className="px-5 py-3.5 text-gray-500">{v.crew_name}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}
                    >
                      {s.label}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── Crews ── */
function PerfTab({ crews }: { crews: CrewPerf[] }) {
  const maxTotal = Math.max(
    ...crews.map((c) => c.completed + c.in_progress + c.planned + c.missed),
    1
  );

  return (
    <div className="divide-y divide-gray-100">
      {crews.map((c) => {
        const total = c.completed + c.in_progress + c.planned + c.missed;
        const rate = total > 0 ? Math.round((c.completed / total) * 100) : 0;
        return (
          <div key={c.name} className="flex items-center gap-6 px-5 py-4">
            <div className="w-36 shrink-0">
              <p className="font-semibold text-navy-700">{c.name}</p>
              <span
                className={`mt-0.5 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  c.category === "pump"
                    ? "bg-blue-50 text-blue-600"
                    : "bg-gold-50 text-gold-600"
                }`}
              >
                {c.category === "pump" ? "Bomba" : "Incendio"}
              </span>
            </div>

            <div className="flex-1">
              <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                <div className="flex h-full">
                  {c.completed > 0 && (
                    <div
                      className="bg-emerald-400"
                      style={{ width: `${(c.completed / maxTotal) * 100}%` }}
                    />
                  )}
                  {c.in_progress > 0 && (
                    <div
                      className="bg-amber-400"
                      style={{ width: `${(c.in_progress / maxTotal) * 100}%` }}
                    />
                  )}
                  {c.planned > 0 && (
                    <div
                      className="bg-navy-200"
                      style={{ width: `${(c.planned / maxTotal) * 100}%` }}
                    />
                  )}
                  {c.missed > 0 && (
                    <div
                      className="bg-red-300"
                      style={{ width: `${(c.missed / maxTotal) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex w-14 shrink-0 justify-end">
              <span className="text-sm font-bold text-navy-700">{rate}%</span>
            </div>
            <div className="flex shrink-0 gap-4 text-xs tabular-nums">
              <span className="font-semibold text-emerald-600" title="Completadas">
                {c.completed}
              </span>
              <span className="font-semibold text-amber-500" title="En progreso">
                {c.in_progress}
              </span>
              <span className="text-gray-400" title="Planificadas">
                {c.planned}
              </span>
              <span className="font-bold text-navy-700" title="Total">
                {total}
              </span>
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-5 px-5 py-3 text-[10px] uppercase tracking-wider text-gray-400">
        <Legend color="bg-emerald-400" label="Completadas" />
        <Legend color="bg-amber-400" label="En Progreso" />
        <Legend color="bg-navy-200" label="Planificadas" />
        <Legend color="bg-red-300" label="Perdidas" />
      </div>
    </div>
  );
}

/* ── Reportes ── */
function ReportsTab({ reports }: { reports: ReportRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            <Th>Fecha</Th>
            <Th>Edificio</Th>
            <Th>Estado</Th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-5 py-12 text-center text-gray-400">
                Sin reportes generados.
              </td>
            </tr>
          ) : (
            reports.map((r) => {
              const s = reportStatusConfig[r.status] ?? reportStatusConfig.draft;
              return (
                <tr
                  key={r.id}
                  className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/50"
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500">
                    {r.report_date}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-navy-700">
                    {r.building_name}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}
                    >
                      {s.label}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400 ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
