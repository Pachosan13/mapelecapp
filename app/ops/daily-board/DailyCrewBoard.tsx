"use client";

import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import OpsVisitsToast from "../visits/OpsVisitsToast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCrewLabel } from "@/lib/formatters/crewLabel";
import { formatAssignmentLabel } from "@/lib/formatters/assignmentLabel";
import type { CrewForLabel } from "@/lib/formatters/crewLabel";
import type { Database } from "@/lib/database.types";

type Crew = {
  id: string;
  name: string;
  leader?: { full_name: string | null };
  helper?: { full_name: string | null };
};

type Visit = {
  id: string;
  status?: string | null;
  scheduled_for: string;
  assigned_crew_id: string | null;
  assigned_tech_user_id: string | null;
  building: { id: string; name: string } | null;
  template: { id: string; name: string } | null;
};

type DailyCrewBoardProps = {
  crews: Crew[];
  visits: Visit[];
  techById: Map<string, { full_name?: string | null }>;
  crewDisplayById: Map<string, CrewForLabel>;
};

type VisitUpdate = Database["public"]["Tables"]["visits"]["Update"];

const formatStatus = (status?: string | null) => {
  if (!status) return "Scheduled";
  return status.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
};

const statusDotClass = (status?: string | null) => {
  switch (status) {
    case "planned":
      return "bg-gray-300";
    case "in_progress":
      return "bg-blue-400";
    case "completed":
      return "bg-emerald-400";
    default:
      return "bg-gray-300";
  }
};

export default function DailyCrewBoard({
  crews,
  visits: initialVisits,
  techById,
  crewDisplayById,
}: DailyCrewBoardProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [visits, setVisits] = useState<Visit[]>(initialVisits);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [draggingVisitId, setDraggingVisitId] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(null);
    window.setTimeout(() => {
      setToastMessage(message);
    }, 0);
  };

  const { visitsByCrewId, unassignedVisits } = useMemo(() => {
    const grouped = new Map<string, Visit[]>();
    crews.forEach((crew) => grouped.set(crew.id, []));
    const unassigned: Visit[] = [];

    visits.forEach((visit) => {
      if (visit.assigned_crew_id && grouped.has(visit.assigned_crew_id)) {
        grouped.get(visit.assigned_crew_id)?.push(visit);
      } else {
        unassigned.push(visit);
      }
    });

    return { visitsByCrewId: grouped, unassignedVisits: unassigned };
  }, [crews, visits]);

  const handleDragStart = (event: DragEvent<HTMLDivElement>, visit: Visit) => {
    if (visit.status !== "planned") {
      event.preventDefault();
      showToast("Solo puedes mover visitas en estado planned.");
      return;
    }
    if (visit.assigned_tech_user_id) {
      event.preventDefault();
      showToast("No se puede mover: ya fue tomada por un técnico.");
      return;
    }
    event.dataTransfer.setData("text/plain", visit.id);
    event.dataTransfer.effectAllowed = "move";
    setDraggingVisitId(visit.id);
  };

  const handleDragEnd = () => {
    setDraggingVisitId(null);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>, targetCrewId: string) => {
    event.preventDefault();
    const visitId = event.dataTransfer.getData("text/plain");
    if (!visitId) return;

    const visit = visits.find((item) => item.id === visitId);
    if (!visit) return;

    if (visit.status !== "planned") {
      showToast("Solo puedes mover visitas en estado planned.");
      return;
    }

    if (visit.assigned_tech_user_id) {
      showToast("No se puede mover: ya fue tomada por un técnico.");
      return;
    }

    if (visit.assigned_crew_id === targetCrewId) {
      return;
    }

    const previousCrewId = visit.assigned_crew_id;
    setVisits((prev) =>
      prev.map((item) =>
        item.id === visitId ? { ...item, assigned_crew_id: targetCrewId } : item
      )
    );

    const visitsTable = supabase.from("visits") as unknown as {
      update: (values: VisitUpdate) => any;
      eq: (col: string, val: any) => any;
      is: (col: string, val: any) => any;
    };

    const { data, error } = await visitsTable
      .update({ assigned_crew_id: targetCrewId } as unknown as VisitUpdate)
      .eq("id", visitId)
      .eq("status", "planned")
      .is("assigned_tech_user_id", null)
      .select("id,assigned_crew_id")
      .maybeSingle();

    if (error || !data) {
      setVisits((prev) =>
        prev.map((item) =>
          item.id === visitId ? { ...item, assigned_crew_id: previousCrewId } : item
        )
      );
      showToast("La visita cambió de estado. Refresca.");
      return;
    }

    showToast("Visita reasignada.");
  };

  return (
    <div className="space-y-5">
      <OpsVisitsToast message={toastMessage ?? undefined} />
      <div className="grid gap-5 lg:grid-cols-3 xl:grid-cols-5">
        {crews.map((crew) => {
          const crewVisits = visitsByCrewId.get(crew.id) ?? [];
          return (
            <div
              key={crew.id}
              className="rounded-2xl border border-gray-100 bg-white"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-sm font-semibold text-gray-900">
                  {formatCrewLabel(crew)}
                </div>
                <span className="text-xs text-gray-400">{crewVisits.length}</span>
              </div>
              <div
                className="space-y-4 px-4 pb-4"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, crew.id)}
              >
                {crewVisits.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400">
                    Sin visitas
                  </div>
                ) : (
                  crewVisits.map((visit) => (
                    <div
                      key={visit.id}
                      draggable
                      onDragStart={(event) => handleDragStart(event, visit)}
                      onDragEnd={handleDragEnd}
                      className={`rounded-xl border border-gray-100 bg-white p-3 text-sm ${
                        draggingVisitId === visit.id ? "opacity-60" : ""
                      } ${visit.status === "planned" ? "cursor-grab" : "cursor-not-allowed"}`}
                    >
                      <div className="font-medium">
                        {visit.building?.name ?? "Building sin nombre"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {visit.template?.name ?? "Formulario sin asignar"}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {(() => {
                          const hasRealLeader = Boolean(
                            visit.assigned_tech_user_id
                          );
                          const label = formatAssignmentLabel(
                            visit,
                            techById,
                            crewDisplayById
                          );
                          if (hasRealLeader) return <>Líder: {label}</>;
                          if (label !== "Técnico sin asignar")
                            return <>Asignado: {label}</>;
                          return <>{label}</>;
                        })()}
                      </div>
                      <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500">
                        <span
                          className={`h-2 w-2 rounded-full ${statusDotClass(
                            visit.status
                          )}`}
                        />
                        {formatStatus(visit.status)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
        <div className="rounded-2xl border border-gray-100 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-sm font-semibold text-gray-700">
              Unassigned/Legacy
            </div>
            <span className="text-xs text-gray-400">{unassignedVisits.length}</span>
          </div>
          <div className="space-y-4 px-4 pb-4">
            {unassignedVisits.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400">
                Sin visitas
              </div>
            ) : (
              unassignedVisits.map((visit) => (
                <div
                  key={visit.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, visit)}
                  onDragEnd={handleDragEnd}
                  className={`rounded-xl border border-gray-100 bg-white p-3 text-sm ${
                    draggingVisitId === visit.id ? "opacity-60" : ""
                  } ${visit.status === "planned" ? "cursor-grab" : "cursor-not-allowed"}`}
                >
                  <div className="font-medium">
                    {visit.building?.name ?? "Building sin nombre"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {visit.template?.name ?? "Formulario sin asignar"}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {(() => {
                      const hasRealLeader = Boolean(
                        visit.assigned_tech_user_id
                      );
                      const label = formatAssignmentLabel(
                        visit,
                        techById,
                        crewDisplayById
                      );
                      if (hasRealLeader) return <>Líder: {label}</>;
                      if (label !== "Técnico sin asignar")
                        return <>Asignado: {label}</>;
                      return <>{label}</>;
                    })()}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500">
                    <span
                      className={`h-2 w-2 rounded-full ${statusDotClass(
                        visit.status
                      )}`}
                    />
                    {formatStatus(visit.status)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
