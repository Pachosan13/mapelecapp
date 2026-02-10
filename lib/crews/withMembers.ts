/**
 * Derives leader/helper per crew from profiles (home_crew_id).
 * No DB changes. Fallback order: created_at (or user_id) then full_name for stability.
 */

type CrewRow = { id: string; name: string };
type TechProfile = {
  user_id: string;
  full_name: string | null;
  home_crew_id: string | null;
  created_at?: string | null;
};

export type CrewWithDisplay = {
  id: string;
  name: string;
  leader?: { full_name: string | null };
  helper?: { full_name: string | null };
};

export function getCrewsWithDisplay(
  crews: CrewRow[],
  techs: TechProfile[]
): CrewWithDisplay[] {
  const byCrewId = new Map<
    string,
    { full_name: string | null; sortKey: string }[]
  >();
  for (const tech of techs) {
    if (!tech.home_crew_id) continue;
    const list = byCrewId.get(tech.home_crew_id) ?? [];
    const sortKey = (tech.created_at ?? tech.user_id) + "\0" + (tech.full_name ?? "");
    list.push({ full_name: tech.full_name, sortKey });
    byCrewId.set(tech.home_crew_id, list);
  }
  for (const list of byCrewId.values()) {
    list.sort((a, b) => a.sortKey.localeCompare(b.sortKey, "es"));
  }

  return crews.map((crew) => {
    const members = byCrewId.get(crew.id) ?? [];
    const leader = members[0];
    const helper = members[1];
    return {
      id: crew.id,
      name: crew.name,
      ...(leader && { leader: { full_name: leader.full_name } }),
      ...(helper && { helper: { full_name: helper.full_name } }),
    };
  });
}
