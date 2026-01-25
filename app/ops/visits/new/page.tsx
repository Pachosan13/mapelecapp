import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const [buildingsResult, templatesResult, techsResult] = await Promise.all([
    supabase.from("buildings").select("id,name").order("name", { ascending: true }),
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
  ]);

  const buildings = buildingsResult.data ?? [];
  const templates = templatesResult.data ?? [];
  const techs = techsResult.data ?? [];

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

      <form action={createVisit} className="max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Building</label>
          <select
            name="building_id"
            required
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Selecciona un building</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Template</label>
          <select
            name="template_id"
            required
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Selecciona un template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.category})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Scheduled for</label>
          <input
            type="date"
            name="scheduled_for"
            required
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Assign tech</label>
          <select
            name="assigned_tech_user_id"
            required
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Selecciona un tech</option>
            {techs.map((tech) => (
              <option key={tech.user_id} value={tech.user_id}>
                {tech.full_name?.trim() || `Usuario ${tech.user_id.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">
            Create visit
          </button>
          <Link
            href="/ops/dashboard"
            className="rounded border px-4 py-2 text-gray-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
