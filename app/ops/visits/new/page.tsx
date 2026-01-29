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
  const templateId = String(formData.get("template_id") ?? "");
  const scheduledFor = String(formData.get("scheduled_for") ?? "");
  const techUserId = String(formData.get("assigned_tech_user_id") ?? "");

  if (!buildingId || !templateId || !scheduledFor || !techUserId) {
    redirect("/ops/visits/new?error=Todos%20los%20campos%20son%20requeridos");
  }

  const { error } = await supabase.from("visits").insert({
    building_id: buildingId,
    template_id: templateId,
    scheduled_for: scheduledFor,
    assigned_tech_user_id: techUserId,
    status: "planned",
  });

  if (error) {
    redirect(
      `/ops/visits/new?error=${encodeURIComponent(
        "No se pudo crear la visita."
      )}`
    );
  }

  redirect("/ops/dashboard");
}

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = await createClient();

  const [buildingsResult, templatesResult, techsResult, equipmentResult] =
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
    supabase
      .from("profiles")
      .select("user_id,full_name")
      .eq("role", "tech")
      .order("full_name", { ascending: true }),
    supabase
      .from("equipment")
      .select("id,building_id,name,equipment_type,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const buildings = buildingsResult.data ?? [];
  const templates = templatesResult.data ?? [];
  const techs = techsResult.data ?? [];
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
        techs={techs}
        equipment={equipment}
      />
    </div>
  );
}
