import Link from "next/link";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { panamaDay } from "@/lib/dates/panamaDay";

type VisitStatus = Database["public"]["Tables"]["visits"]["Row"]["status"];

const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

// El helper compartido formatDateOnlyLabel devuelve MM/DD/YYYY (formato gringo).
// En el badge queda ilegible para el técnico, así que acá se rotula "13-jul".
const formatShortDate = (dateStr: string) => {
  const [, m, d] = dateStr.split("-");
  const mes = MESES[Number(m) - 1];
  if (!mes || !d) return dateStr;
  return `${Number(d)}-${mes}`;
};

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
  const supabase = (await createClient()).schema("public");
  const today = panamaDay();
  const uid = user.id;

  const selectFields =
    "id,status,scheduled_for,assigned_crew_id,assigned_tech_user_id,building:buildings(id,name),template:visit_templates(id,name)";

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

  // Visitas de mi cuadrilla que YA reclamó otro compañero. Sin esto el traspaso
  // entre técnicos no servía de nada: la RLS y los gates de la pantalla de visita
  // sí dejan entrar a cualquiera de la cuadrilla, pero apenas alguien daba Start
  // la visita desaparecía de la lista de los demás y no había cómo llegar a ella.
  const { data: crewOtherData, error: crewOtherError } = user.home_crew_id
    ? await supabase
        .from("visits")
        .select(selectFields)
        .eq("scheduled_for", today)
        .in("status", ["planned", "in_progress"])
        .eq("assigned_crew_id", user.home_crew_id)
        .not("assigned_tech_user_id", "is", null)
        .neq("assigned_tech_user_id", uid)
    : { data: [], error: null };

  // Visitas que quedaron abiertas en días anteriores. La lista filtraba por
  // `scheduled_for = hoy`, así que un mantenimiento que no se cerró el mismo día
  // se le desaparecía a todo el mundo al día siguiente, incluido quien lo empezó.
  // De ahí salen las visitas que se quedan en in_progress para siempre: sin
  // completar no generan informe ni muestran hallazgos.
  const { data: carryOverMineData, error: carryOverMineError } = await supabase
    .from("visits")
    .select(selectFields)
    .lt("scheduled_for", today)
    .eq("status", "in_progress")
    .eq("assigned_tech_user_id", uid)
    .order("scheduled_for", { ascending: false })
    .limit(50);

  const { data: carryOverCrewData, error: carryOverCrewError } = user.home_crew_id
    ? await supabase
        .from("visits")
        .select(selectFields)
        .lt("scheduled_for", today)
        .eq("status", "in_progress")
        .eq("assigned_crew_id", user.home_crew_id)
        .order("scheduled_for", { ascending: false })
        .limit(50)
    : { data: [], error: null };

  const merged = [
    ...(legacyData ?? []),
    ...(crewData ?? []),
    ...(crewMineData ?? []),
    ...(crewOtherData ?? []),
    ...(carryOverMineData ?? []),
    ...(carryOverCrewData ?? []),
  ];
  const visitsById = new Map<string, (typeof merged)[number]>();
  merged.forEach((visit) => {
    visitsById.set(visit.id, visit);
  });

  const visits = Array.from(visitsById.values())
    .sort((a, b) => {
      // Las de días anteriores van primero: son las que se quedan atrás y nadie ve.
      const lateA = a.scheduled_for < today ? 0 : 1;
      const lateB = b.scheduled_for < today ? 0 : 1;
      if (lateA !== lateB) return lateA - lateB;
      const nameA = a.building?.name ?? "";
      const nameB = b.building?.name ?? "";
      const nameCompare = nameA.localeCompare(nameB);
      if (nameCompare !== 0) return nameCompare;
      return a.id.localeCompare(b.id);
    }) as Array<{
    id: string;
    status: VisitStatus | null;
    scheduled_for: string;
    assigned_crew_id: string | null;
    assigned_tech_user_id: string | null;
    building: { id: string; name: string } | null;
    template: { id: string; name: string } | null;
  }>;

  const claimedByIds = Array.from(
    new Set(
      visits
        .map((visit) => visit.assigned_tech_user_id)
        .filter((id): id is string => Boolean(id) && id !== uid)
    )
  );
  const { data: claimedProfiles } =
    claimedByIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id,full_name")
          .in("user_id", claimedByIds)
      : { data: [] };
  const claimedNameById = new Map(
    (claimedProfiles ?? []).map((profile) => [
      profile.user_id,
      profile.full_name?.trim() || "otro técnico",
    ])
  );

  const formatStatus = (status?: VisitStatus | null) => {
    if (!status) return "Sin estado";
    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());
  };

  const showCompletedBanner = searchParams?.completed === "1";
  const error =
    legacyError ??
    crewError ??
    crewMineError ??
    crewOtherError ??
    carryOverMineError ??
    carryOverCrewError;

  return (
    <div className="min-h-screen bg-gray-50/40 p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hoy</h1>
          <p className="text-sm text-gray-500">
            Te toca hoy · Incluye las que quedaron abiertas de días anteriores
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
            No tienes visitas asignadas hoy ni pendientes de días anteriores.
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
                  {visit.template?.name ? (
                    <div className="mt-0.5 text-sm font-medium text-slate-600">
                      {visit.template.name}
                    </div>
                  ) : null}
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
                  <div className="mt-1 flex flex-wrap gap-2">
                    {visit.scheduled_for < today ? (
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Quedó abierta · {formatShortDate(visit.scheduled_for)}
                      </span>
                    ) : null}
                    {visit.assigned_tech_user_id &&
                    visit.assigned_tech_user_id !== uid ? (
                      <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                        Iniciada por{" "}
                        {claimedNameById.get(visit.assigned_tech_user_id) ??
                          "otro técnico"}
                      </span>
                    ) : null}
                  </div>
                </div>
                {/* Navegación completa (no <Link>): fuerza un request de documento
                    que el service worker cachea, así la visita abre incluso sin señal
                    si el técnico ya la abrió antes online. */}
                <a
                  href={`/tech/visits/${visit.id}`}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Abrir →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
