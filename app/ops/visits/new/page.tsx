import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewVisitForm from "./NewVisitForm";

type SearchParams = {
  error?: string;
};

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

  const { error } = await supabase.from("visits").insert(
    templateIds.map((templateId) => ({
      building_id: buildingId,
      template_id: templateId,
      scheduled_for: scheduledFor,
      assigned_tech_user_id: null,
      assigned_crew_id: assignedCrewId,
      status: "planned",
    }))
  );

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

  const [buildingsResult, templatesResult, crewsResult, equipmentResult] =
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
      .from("equipment")
      .select("id,building_id,name,equipment_type,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const buildings = buildingsResult.data ?? [];
  const templates = templatesResult.data ?? [];
  const crews = crewsResult.data ?? [];
  const equipment = equipmentResult.data ?? [];

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/dashboard" className="text-sm text-gray-500">
          ← Volver a dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold">New visit</h1>
      </div>

      {searchParams?.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
