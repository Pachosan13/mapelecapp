import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { getCrewsWithDisplay } from "@/lib/crews/withMembers";
import NewVisitForm from "./NewVisitForm";

type SearchParams = {
  error?: string;
};

type VisitInsert = Database["public"]["Tables"]["visits"]["Insert"];
type VisitStatus = NonNullable<Database["public"]["Tables"]["visits"]["Row"]["status"]>;

async function createVisit(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const buildingId = String(formData.get("building_id") ?? "");
  const templateIds = formData
    .getAll("template_ids")
    .map((value) => String(value))
    .filter(Boolean);
  const scheduledFor = String(formData.get("scheduled_for") ?? "");
  const assignedCrewId = String(formData.get("assigned_crew_id") ?? "");

  if (!buildingId || !scheduledFor || !assignedCrewId) {
    redirect("/ops/visits/new?error=Todos%20los%20campos%20son%20requeridos");
  }

  if (templateIds.length === 0) {
    redirect(
      "/ops/visits/new?error=Selecciona%20al%20menos%20un%20template"
    );
  }

  const status: VisitStatus = "planned";
  const rows: VisitInsert[] = templateIds.map((templateId) => ({
    building_id: buildingId,
    template_id: templateId,
    scheduled_for: scheduledFor,
    assigned_tech_user_id: null,
    assigned_crew_id: assignedCrewId,
    status,
  }));

  const { error } = await supabase.from("visits").insert(rows);

  if (error) {
    redirect(
      `/ops/visits/new?error=${encodeURIComponent(
        "No se pudo crear la visita."
      )}`
    );
  }

  redirect(
    `/ops/visits?date=${encodeURIComponent(
      scheduledFor
    )}&building=${encodeURIComponent(
      buildingId
    )}&success=${encodeURIComponent(
      `Se crearon ${templateIds.length} visitas`
    )}`
  );
}

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = await createClient();

  const [buildingsResult, templatesResult, crewsResult, techsResult, equipmentResult] =
    await Promise.all([
    supabase
      .from("buildings")
      .select("id,name,systems")
      .order("name", { ascending: true }),
    supabase
      .from("visit_templates")
      .select("id,name,category")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.from("crews").select("id,name").order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("user_id,full_name,home_crew_id,created_at")
      .eq("role", "tech")
      .eq("is_active", true),
    supabase
      .from("equipment")
      .select("id,building_id,name,equipment_type,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const buildings = buildingsResult.data ?? [];
  const templates = templatesResult.data ?? [];
  const crewsRaw = crewsResult.data ?? [];
  const techs = (techsResult.data ?? []) as Array<{
    user_id: string;
    full_name: string | null;
    home_crew_id: string | null;
  }>;
  const crews = getCrewsWithDisplay(crewsRaw, techs);
  const equipment = equipmentResult.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50/40 p-8">
      <div className="mb-8">
        <Link href="/ops/dashboard" className="text-sm text-gray-500">
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">
          Nueva visita
        </h1>
        <p className="text-sm text-gray-500">
          Completa la información esencial.
        </p>
      </div>

      {searchParams?.error ? (
        <div className="mb-6 rounded-lg border border-red-100 bg-red-50/70 p-3 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </div>
      ) : null}
      <NewVisitForm
        action={createVisit}
        buildings={buildings}
        templates={templates}
        crews={crews}
        equipment={equipment}
      />
    </div>
  );
}
