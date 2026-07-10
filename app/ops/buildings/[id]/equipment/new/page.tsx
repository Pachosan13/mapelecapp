import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EquipmentForm from "@/components/EquipmentForm";
import { buildSpecs, equipmentTypeFor } from "@/lib/equipment/specs";

type SearchParams = {
  error?: string;
};

export default async function NewEquipmentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  const supabase = await createClient();
  const supabaseDb = supabase.schema("public");

  const { data: building, error: buildingError } = await supabaseDb
    .from("buildings")
    .select("id,name")
    .eq("id", params.id)
    .maybeSingle();

  if (buildingError) {
    return (
      <div className="min-h-screen p-8">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando building: {buildingError.message}
        </div>
      </div>
    );
  }

  if (!building) {
    notFound();
  }

  async function createEquipment(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const supabaseDb = supabase.schema("public");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      redirect("/login");
    }

    const buildingId = String(formData.get("building_id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const system = String(formData.get("system") ?? "").trim();
    const kind = String(formData.get("kind") ?? "").trim();
    const manufacturer = String(formData.get("manufacturer") ?? "").trim();
    const model = String(formData.get("model") ?? "").trim();
    const serial = String(formData.get("serial") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    const tag = String(formData.get("tag") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const isActive = formData.get("is_active") === "on";

    const errUrl = (msg: string) =>
      `/ops/buildings/${params.id}/equipment/new?error=${encodeURIComponent(msg)}`;

    if (!buildingId || !name || !system || !kind) {
      redirect(errUrl("Nombre, sistema y tipo son requeridos."));
    }

    const specs = buildSpecs(formData, kind);
    const equipmentType = equipmentTypeFor(system);

    // Los equipos nuevos entran al FINAL del inventario del edificio (max+10).
    const { data: lastRow } = await supabaseDb
      .from("equipment")
      .select("sort_order")
      .eq("building_id", buildingId)
      .order("sort_order", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const nextSortOrder = (lastRow?.sort_order ?? 0) + 10;

    const { data: created, error } = await supabaseDb.from("equipment").insert({
      building_id: buildingId,
      name,
      equipment_type: equipmentType,
      system,
      kind,
      specs,
      manufacturer: manufacturer || null,
      model: model || null,
      serial: serial || null,
      location: location || null,
      tag: tag || null,
      is_active: isActive,
      notes: notes || null,
      sort_order: nextSortOrder,
    }).select("id").maybeSingle();

    if (error) {
      redirect(
        errUrl(
          error.code === "23505"
            ? "Ya existe un equipo con ese nombre en este edificio."
            : "No se pudo crear el equipo."
        )
      );
    }

    // Cae DIRECTO en la ficha del equipo nuevo para subirle las fotos
    // (feedback William: "que en ese mapeo suban la foto"). Fallback a la lista.
    if (created?.id) {
      redirect(
        `/ops/buildings/${params.id}/equipment/${created.id}/edit?created=1`
      );
    }
    redirect(`/ops/buildings/${params.id}/equipment`);
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <a
          href={`/ops/buildings/${building.id}/equipment`}
          className="text-sm text-gray-500"
        >
          ← Volver a equipos
        </a>
        <h1 className="mt-2 text-2xl font-bold">Agregar equipo</h1>
        <p className="text-gray-600">{building.name}</p>
      </div>

      <EquipmentForm
        buildingId={building.id}
        action={createEquipment}
        cancelHref={`/ops/buildings/${building.id}/equipment`}
        error={
          searchParams?.error ? decodeURIComponent(searchParams.error) : undefined
        }
      />
    </div>
  );
}
