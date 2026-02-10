/**
 * Display label for a crew in the UI.
 * Uses technician leader (+ optional helper) instead of "Cuadrilla X".
 * Never shows crew IDs or "Cuadrilla" in the UI.
 */

export type CrewForLabel = {
  leader?: { full_name?: string | null } | null;
  helper?: { full_name?: string | null } | null;
};

export function formatCrewLabel(crew: CrewForLabel | null | undefined): string {
  if (!crew?.leader?.full_name?.trim()) {
    return "Técnico sin asignar";
  }
  const leaderName = crew.leader.full_name.trim();
  const helperName = crew.helper?.full_name?.trim();
  if (helperName) {
    return `${leaderName} (+ ${helperName})`;
  }
  return leaderName;
}
