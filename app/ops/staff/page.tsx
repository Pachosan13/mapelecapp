import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllProfiles } from "@/lib/profiles/queries";
import { getCrewsWithDisplay } from "@/lib/crews/withMembers";
import CrewAssignments from "./CrewAssignments";

export default async function StaffPage() {
  const supabase = await createClient();

  const [profilesResult, crewsResult] = await Promise.all([
    getAllProfiles(),
    supabase.from("crews").select("id,name").order("name", { ascending: true }),
  ]);

  const profiles = profilesResult.data ?? [];
  const crewsRaw = crewsResult.data ?? [];
  const hasError = Boolean(profilesResult.error || crewsResult.error);
  const techProfiles = profiles.filter((profile) => profile.role === "tech");
  const crews = getCrewsWithDisplay(crewsRaw, techProfiles);

  return (
    <div className="min-h-screen bg-gray-50/40 p-8">
      <div className="mb-8">
        <Link href="/ops/dashboard" className="text-sm text-gray-500">
          ← Volver a dashboard
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Equipos</h1>
            <p className="mt-1 text-sm text-gray-500">
              Asigna técnicos a su equipo principal.
            </p>
          </div>
          <Link
            href="/ops/staff/invite"
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Invitar técnico
          </Link>
        </div>
      </div>

      {hasError ? (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando equipos. Intenta de nuevo.
        </div>
      ) : null}

      <CrewAssignments crews={crews} techs={techProfiles} />
    </div>
  );
}
