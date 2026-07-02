/**
 * Display label for a crew in the UI.
 * Con técnicos: muestra el líder (+ ayudante opcional) en vez de "Cuadrilla X".
 * Sin técnicos (cuadrilla vacía): muestra el NOMBRE de la cuadrilla, para que dos
 * cuadrillas vacías no salgan ambas como el mismo genérico y se puedan distinguir.
 */

export type CrewForLabel = {
  name?: string | null;
  leader?: { full_name?: string | null } | null;
  helper?: { full_name?: string | null } | null;
};

export function formatCrewLabel(crew: CrewForLabel | null | undefined): string {
  const leaderName = crew?.leader?.full_name?.trim();
  if (!leaderName) {
    const crewName = crew?.name?.trim();
    return crewName ? `${crewName} (sin técnico)` : "Cuadrilla sin técnico";
  }
  const helperName = crew?.helper?.full_name?.trim();
  if (helperName) {
    return `${leaderName} (+ ${helperName})`;
  }
  return leaderName;
}
