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
    <div className="min-h-screen bg-gray-50/40 p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hoy</h1>
          <p className="text-sm text-gray-500">
            {displayName} · Visitas programadas para hoy
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <Link href="/tech/history" className="hover:text-gray-900">
            Ver historial
          </Link>
          <Link href="/tech/today" className="hover:text-gray-900">
            Refresh
          </Link>
        </div>
      </div>

      {showCompletedBanner ? (
        <div className="mb-6 rounded-lg border border-green-100 bg-green-50/70 px-4 py-3 text-sm font-medium text-green-800">
          Visita completada ✅
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50/70 p-3 text-sm text-red-700">
          Error cargando visitas: {error.message}
        </div>
      ) : null}

      <div className="mt-6">
        {visits.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-6 py-10 text-sm text-gray-500">
            No tienes visitas asignadas hoy.
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white">
            {visits.map((visit, index) => (
              <div
                key={visit.id}
                className={`flex items-center justify-between gap-6 px-6 py-5 ${
                  index === 0 ? "" : "border-t border-gray-100"
                }`}
              >
                <div>
                  <div
                    className={`font-semibold text-gray-900 ${
                      visits.length === 1 ? "text-xl" : "text-base"
                    }`}
                  >
                    {visit.building?.name ?? "—"}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-2 text-sm text-gray-500">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        visit.status === "planned"
                          ? "bg-gray-300"
                          : visit.status === "in_progress"
                            ? "bg-blue-400"
                            : visit.status === "completed"
                              ? "bg-emerald-400"
                              : "bg-gray-300"
                      }`}
                    />
                    {formatStatus(visit.status)}
                  </div>
                </div>
                <Link
                  href={`/tech/visits/${visit.id}`}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Abrir →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
