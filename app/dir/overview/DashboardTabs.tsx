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

type Building = {
  id: string;
  name: string;
  visit_count: number;
  last_visit: string | null;
  systems: string[];
};

type CrewPerf = {
  name: string;
  category: string;
  completed: number;
  in_progress: number;
  planned: number;
};

type TemplateStats = {
  name: string;
  total_responses: number;
  visits_using: number;
};

interface DashboardTabsProps {
  visits: Visit[];
  buildings: Building[];
  crews: CrewPerf[];
  templates: TemplateStats[];
}

const tabs = [
  { key: "ops", label: "Operaciones" },
  { key: "assets", label: "Activos" },
  { key: "perf", label: "Performance" },
  { key: "nfpa", label: "NFPA" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  completed: { label: "Completada", bg: "bg-emerald-50", text: "text-emerald-700" },
  in_progress: { label: "En Progreso", bg: "bg-blue-50", text: "text-blue-700" },
  planned: { label: "Planificada", bg: "bg-navy-50", text: "text-navy-600" },
  missed: { label: "Perdida", bg: "bg-red-50", text: "text-red-700" },
};

export default function DashboardTabs({
  visits,
  buildings,
  crews,
  templates,
}: DashboardTabsProps) {
  const [active, setActive] = useState<TabKey>("ops");

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
        {active === "ops" && <OpsTab visits={visits} />}
        {active === "assets" && <AssetsTab buildings={buildings} />}
        {active === "perf" && <PerfTab crews={crews} />}
        {active === "nfpa" && <NfpaTab templates={templates} />}
      </div>
    </div>
  );
}

/* ── Operaciones ── */
function OpsTab({ visits }: { visits: Visit[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Fecha
            </th>
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Edificio
            </th>
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Template
            </th>
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Crew
            </th>
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {visits.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                Sin visitas en este periodo.
              </td>
            </tr>
          ) : (
            visits.map((v) => {
              const s = statusConfig[v.status] ?? statusConfig.planned;
              return (
                <tr
                  key={v.id}
                  className="border-b border-gray-50 transition-colors hover:bg-gray-50/50 last:border-0"
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

/* ── Activos ── */
function AssetsTab({ buildings }: { buildings: Building[] }) {
  const sorted = [...buildings].sort((a, b) => b.visit_count - a.visit_count);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80">
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Edificio
            </th>
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Sistemas
            </th>
            <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Visitas
            </th>
            <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-navy-400">
              Última Visita
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => (
            <tr
              key={b.id}
              className="border-b border-gray-50 transition-colors hover:bg-gray-50/50 last:border-0"
            >
              <td className="px-5 py-3.5 font-semibold text-navy-700">{b.name}</td>
              <td className="px-5 py-3.5">
                <div className="flex gap-1.5">
                  {b.systems.map((s) => (
                    <span
                      key={s}
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        s === "pump"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-gold-50 text-gold-600"
                      }`}
                    >
                      {s === "pump" ? "Bomba" : "Incendio"}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-5 py-3.5 text-right">
                <span className="font-mono text-sm font-bold text-navy-700">
                  {b.visit_count}
                </span>
              </td>
              <td className="px-5 py-3.5 font-mono text-xs text-gray-400">
                {b.last_visit ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Performance ── */
function PerfTab({ crews }: { crews: CrewPerf[] }) {
  const maxTotal = Math.max(...crews.map((c) => c.completed + c.in_progress + c.planned), 1);

  return (
    <div className="divide-y divide-gray-100">
      {crews.map((c) => {
        const total = c.completed + c.in_progress + c.planned;
        const pct = Math.round((total / maxTotal) * 100);
        return (
          <div key={c.name} className="flex items-center gap-6 px-5 py-4">
            {/* Crew info */}
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

            {/* Bar */}
            <div className="flex-1">
              <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                <div className="flex h-full">
                  {c.completed > 0 && (
                    <div
                      className="bg-emerald-400 transition-all"
                      style={{ width: `${(c.completed / maxTotal) * 100}%` }}
                    />
                  )}
                  {c.in_progress > 0 && (
                    <div
                      className="bg-blue-400 transition-all"
                      style={{ width: `${(c.in_progress / maxTotal) * 100}%` }}
                    />
                  )}
                  {c.planned > 0 && (
                    <div
                      className="bg-navy-200 transition-all"
                      style={{ width: `${(c.planned / maxTotal) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Numbers */}
            <div className="flex shrink-0 gap-4 text-xs">
              <span className="font-semibold text-emerald-600">{c.completed}</span>
              <span className="font-semibold text-blue-500">{c.in_progress}</span>
              <span className="text-gray-400">{c.planned}</span>
              <span className="font-bold text-navy-700">{total}</span>
            </div>
          </div>
        );
      })}
      {/* Legend */}
      <div className="flex gap-5 px-5 py-3 text-[10px] uppercase tracking-wider text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Completadas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
          En Progreso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-navy-200" />
          Planificadas
        </span>
      </div>
    </div>
  );
}

/* ── NFPA ── */
function NfpaTab({ templates }: { templates: TemplateStats[] }) {
  const maxResponses = Math.max(...templates.map((t) => t.total_responses), 1);

  return (
    <div className="divide-y divide-gray-100">
      {templates.map((t) => (
        <div key={t.name} className="px-5 py-4">
          <div className="flex items-baseline justify-between">
            <p className="font-semibold text-navy-700">{t.name}</p>
            <div className="flex gap-6 text-xs">
              <span>
                <span className="font-bold text-navy-700">{t.visits_using}</span>{" "}
                <span className="text-gray-400">visitas</span>
              </span>
              <span>
                <span className="font-bold text-gold-500">{t.total_responses}</span>{" "}
                <span className="text-gray-400">respuestas</span>
              </span>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gold-400 transition-all"
              style={{ width: `${(t.total_responses / maxResponses) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
