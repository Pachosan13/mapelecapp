/**
 * Display label for "who is responsible" for a visit.
 * Prefers assigned_tech_user_id (real leader); falls back to crew display.
 */

import { formatCrewLabel } from "./crewLabel";
import type { CrewForLabel } from "./crewLabel";

export type VisitForAssignment = {
  assigned_tech_user_id?: string | null;
  assigned_crew_id?: string | null;
};

export function formatAssignmentLabel(
  visit: VisitForAssignment | null | undefined,
  techById: Map<string, { full_name?: string | null }>,
  crewDisplayById: Map<string, CrewForLabel>
): string {
  if (!visit) return "Técnico sin asignar";
  const techId = visit.assigned_tech_user_id;
  if (techId) {
    const tech = techById.get(techId);
    const name = tech?.full_name?.trim();
    if (name) return name;
    return "Técnico sin asignar";
  }
  const crewId = visit.assigned_crew_id;
  if (crewId) {
    const crew = crewDisplayById.get(crewId);
    return formatCrewLabel(crew);
  }
  return "Técnico sin asignar";
}
