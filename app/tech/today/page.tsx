import Link from "next/link";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TechTodayPage({
  searchParams,
}: {
  searchParams?: { completed?: string };
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "tech") {
    redirect("/login");
  }

  const displayName =
    user.full_name?.trim() || `Usuario ${user.id.slice(0, 6)}`;
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Panama",
  }).format(new Date());
  const uid = user.user_id ?? user.id;

  const selectFields =
    "id,status,scheduled_for,assigned_crew_id,assigned_tech_user_id,building:buildings(id,name)";

  const { data: legacyData, error: legacyError } = await supabase
    .from("visits")
    .select(selectFields)
    .eq("scheduled_for", today)
    .in("status", ["planned", "in_progress"])
    .eq("assigned_tech_user_id", uid);

  const { data: crewData, error: crewError } = user.home_crew_id
    ? await supabase
        .from("visits")
        .select(selectFields)
        .eq("scheduled_for", today)
        .in("status", ["planned", "in_progress"])
        .eq("assigned_crew_id", user.home_crew_id)
        .is("assigned_tech_user_id", null)
    : { data: [], error: null };

  const { data: crewMineData, error: crewMineError } = user.home_crew_id
    ? await supabase
        .from("visits")
        .select(selectFields)
        .eq("scheduled_for", today)
        .in("status", ["planned", "in_progress"])
        .eq("assigned_crew_id", user.home_crew_id)
        .eq("assigned_tech_user_id", uid)
    : { data: [], error: null };

  const merged = [
    ...(legacyData ?? []),
    ...(crewData ?? []),
    ...(crewMineData ?? []),
  ];
  const visitsById = new Map<string, (typeof merged)[number]>();
  merged.forEach((visit) => {
    visitsById.set(visit.id, visit);
  });

  const visits = Array.from(visitsById.values())
    .sort((a, b) => {
      const nameA = a.building?.name ?? "";
      const nameB = b.building?.name ?? "";
      const nameCompare = nameA.localeCompare(nameB);
      if (nameCompare !== 0) return nameCompare;
      return a.id.localeCompare(b.id);
    }) as Array<{
    id: string;
    status: string;
    scheduled_for: string;
    assigned_crew_id: string | null;
    assigned_tech_user_id: string | null;
    building: { id: string; name: string } | null;
  }>;

  const formatStatus = (status?: string) => {
    if (!status) return "Sin estado";
    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  };

  const showCompletedBanner = searchParams?.completed === "1";
  const error = legacyError ?? crewError ?? crewMineError;

  return (
    <div className="min-h-screen p-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tech - Hoy</h1>
          <p className="text-gray-600">
            {displayName} · Visitas programadas para hoy
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/tech/history" className="text-blue-600 hover:underline">
            Ver historial
          </Link>
          <Link href="/tech/today" className="text-blue-600 hover:underline">
            Refresh
          </Link>
        </div>
      </div>

      {showCompletedBanner ? (
        <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Visita completada ✅
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando visitas: {error.message}
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Building</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {visits.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={3}>
                  No tienes visitas asignadas hoy.
                </td>
              </tr>
            ) : (
              visits.map((visit) => (
                <tr key={visit.id} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    {visit.building?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                      {formatStatus(visit.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/tech/visits/${visit.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
