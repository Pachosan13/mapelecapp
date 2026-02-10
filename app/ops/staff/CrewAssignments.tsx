"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCrewLabel } from "@/lib/formatters/crewLabel";

type Crew = {
  id: string;
  name: string;
  leader?: { full_name: string | null };
  helper?: { full_name: string | null };
};

type TechProfile = {
  user_id: string;
  full_name: string | null;
  home_crew_id: string | null;
};

type CrewAssignmentsProps = {
  crews: Crew[];
  techs: TechProfile[];
};

type StatusState = "idle" | "saving" | "saved" | "error";

export default function CrewAssignments({ crews, techs }: CrewAssignmentsProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [statusByTech, setStatusByTech] = useState<Record<string, StatusState>>(
    () => Object.fromEntries(techs.map((tech) => [tech.user_id, "idle"]))
  );
  const [assignedCrewByTech, setAssignedCrewByTech] = useState<
    Record<string, string | null>
  >(() =>
    Object.fromEntries(techs.map((tech) => [tech.user_id, tech.home_crew_id]))
  );

  const showToast = (message: string, tone: "success" | "error") => {
    setToast(null);
    window.setTimeout(() => {
      setToast({ message, tone });
    }, 0);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleCrewChange = async (techId: string, crewId: string) => {
    const previousValue = assignedCrewByTech[techId] ?? null;
    const nextValue = crewId === "none" ? null : crewId;

    setAssignedCrewByTech((prev) => ({ ...prev, [techId]: nextValue }));
    setStatusByTech((prev) => ({ ...prev, [techId]: "saving" }));

    const { error } = await supabase
      .from("profiles")
      .update({ home_crew_id: nextValue })
      .eq("user_id", techId);

    if (error) {
      setAssignedCrewByTech((prev) => ({ ...prev, [techId]: previousValue }));
      setStatusByTech((prev) => ({ ...prev, [techId]: "error" }));
      showToast("No se pudo guardar. Intenta de nuevo.", "error");
      return;
    }

    setStatusByTech((prev) => ({ ...prev, [techId]: "saved" }));
    showToast("Equipo actualizado.", "success");
  };

  if (techs.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        No hay técnicos activos para asignar.
      </div>
    );
  }

  return (
    <div>
      {toast ? (
        <div
          className={`mb-4 rounded border p-3 text-sm ${
            toast.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="divide-y divide-gray-100">
          {techs.map((tech) => {
            const displayName =
              tech.full_name?.trim() || `Usuario ${tech.user_id.slice(0, 6)}`;
            const status = statusByTech[tech.user_id] ?? "idle";
            return (
              <div
                key={tech.user_id}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"
              >
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {displayName}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">
                    Equipo
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <select
                      value={assignedCrewByTech[tech.user_id] ?? "none"}
                      onChange={(event) =>
                        handleCrewChange(tech.user_id, event.target.value)
                      }
                      className="min-w-[220px] rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    >
                      <option value="none">Sin asignar</option>
                      {crews.map((crew) => (
                        <option key={crew.id} value={crew.id}>
                          {formatCrewLabel(crew)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-gray-400">
                    {status === "saving"
                      ? "Guardando…"
                      : status === "saved"
                      ? "Guardado"
                      : status === "error"
                      ? "Error"
                      : " "}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
