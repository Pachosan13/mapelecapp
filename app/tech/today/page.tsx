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
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("visits")
    .select("id,status,scheduled_for,building:buildings(id,name)")
    .eq("assigned_tech_user_id", user.id)
    .eq("scheduled_for", today)
    .order("scheduled_for", { ascending: true });

  const visits = (data ?? []) as Array<{
    id: string;
    status: string;
    scheduled_for: string;
    building: { id: string; name: string } | null;
  }>;

  const formatStatus = (status?: string) => {
    if (!status) return "Sin estado";
    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  };

  const showCompletedBanner = searchParams?.completed === "1";

  return (
    <div className="min-h-screen p-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tech - Hoy</h1>
          <p className="text-gray-600">
            {displayName} · Visitas programadas para hoy
          </p>
        </div>
        <Link
          href="/tech/today"
          className="text-sm text-blue-600 hover:underline"
        >
          Refresh
        </Link>
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
