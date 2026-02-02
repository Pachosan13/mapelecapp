"use client";

import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import OpsVisitsToast from "../visits/OpsVisitsToast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Crew = {
  id: string;
  name: string;
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
};

const statusBadgeClass = (status?: string | null) => {
  switch (status) {
    case "planned":
      return "bg-amber-100 text-amber-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const formatStatus = (status?: string | null) => {
  if (!status) return "Scheduled";
  return status.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
};

export default function DailyCrewBoard({ crews, visits: initialVisits }: DailyCrewBoardProps) {
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

    const { data, error } = await supabase
      .from("visits")
      .update({ assigned_crew_id: targetCrewId })
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
    <div className="space-y-4">
      <OpsVisitsToast message={toastMessage ?? undefined} />
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {crews.map((crew) => {
          const crewVisits = visitsByCrewId.get(crew.id) ?? [];
          return (
            <div key={crew.id} className="rounded border bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="text-sm font-semibold">{crew.name}</div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                  {crewVisits.length}
                </span>
              </div>
              <div
                className="space-y-3 p-3"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, crew.id)}
              >
                {crewVisits.length === 0 ? (
                  <div className="rounded border border-dashed px-3 py-6 text-center text-sm text-gray-400">
                    Sin visitas
                  </div>
                ) : (
                  crewVisits.map((visit) => (
                    <div
                      key={visit.id}
                      draggable
                      onDragStart={(event) => handleDragStart(event, visit)}
                      onDragEnd={handleDragEnd}
                      className={`rounded border bg-white p-3 text-sm shadow-sm ${
                        draggingVisitId === visit.id ? "opacity-60" : ""
                      } ${visit.status === "planned" ? "cursor-grab" : "cursor-not-allowed"}`}
                    >
                      <div className="font-medium">
                        {visit.building?.name ?? "Building sin nombre"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {visit.template?.name ?? "Template sin asignar"}
                      </div>
                      <div className="mt-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${statusBadgeClass(
                            visit.status
                          )}`}
                        >
                          {formatStatus(visit.status)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
        <div className="rounded border bg-gray-50">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-sm font-semibold text-gray-700">Unassigned/Legacy</div>
            <span className="rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-700">
              {unassignedVisits.length}
            </span>
          </div>
          <div className="space-y-3 p-3">
            {unassignedVisits.length === 0 ? (
              <div className="rounded border border-dashed px-3 py-6 text-center text-sm text-gray-400">
                Sin visitas
              </div>
            ) : (
              unassignedVisits.map((visit) => (
                <div
                  key={visit.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, visit)}
                  onDragEnd={handleDragEnd}
                  className={`rounded border bg-white p-3 text-sm shadow-sm ${
                    draggingVisitId === visit.id ? "opacity-60" : ""
                  } ${visit.status === "planned" ? "cursor-grab" : "cursor-not-allowed"}`}
                >
                  <div className="font-medium">
                    {visit.building?.name ?? "Building sin nombre"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {visit.template?.name ?? "Template sin asignar"}
                  </div>
                  <div className="mt-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${statusBadgeClass(
                        visit.status
                      )}`}
                    >
                      {formatStatus(visit.status)}
                    </span>
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
