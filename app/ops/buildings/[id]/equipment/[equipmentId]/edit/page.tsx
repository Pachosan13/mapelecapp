import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const EQUIPMENT_TYPE_OPTIONS = [
  { value: "pump", label: "Bombas" },
  { value: "fire", label: "Incendio" },
];

type SearchParams = {
  error?: string;
};

export default async function EditEquipmentPage({
  params,
  searchParams,
}: {
  params: { id: string; equipmentId: string };
  searchParams?: SearchParams;
}) {
  const supabase = await createClient();

  const { data: equipment, error: equipmentError } = await supabase
    .from("equipment")
    .select(
      "id,building_id,name,equipment_type,is_active,manufacturer,model,serial,location,tag,notes"
    )
    .eq("id", params.equipmentId)
    .eq("building_id", params.id)
    .maybeSingle();

  if (equipmentError) {
    return (
      <div className="min-h-screen p-8">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando equipo: {equipmentError.message}
        </div>
      </div>
    );
  }

  if (!equipment) {
    notFound();
  }

  const { data: building, error: buildingError } = await supabase
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

  async function updateEquipment(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      redirect("/login");
    }

    const id = String(formData.get("id") ?? "");
    const buildingId = String(formData.get("building_id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const equipmentType = String(formData.get("equipment_type") ?? "").trim();
    const manufacturer = String(formData.get("manufacturer") ?? "").trim();
    const model = String(formData.get("model") ?? "").trim();
    const serial = String(formData.get("serial") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    const tag = String(formData.get("tag") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const isActive = formData.get("is_active") === "on";

    if (!id || !buildingId || !name || !equipmentType) {
      redirect(
        `/ops/buildings/${params.id}/equipment/${params.equipmentId}/edit?error=${encodeURIComponent(
          "Nombre y tipo son requeridos."
        )}`
      );
    }

    const { error } = await supabase
      .from("equipment")
      .update({
        name,
        equipment_type: equipmentType,
        manufacturer: manufacturer || null,
        model: model || null,
        serial: serial || null,
        location: location || null,
        tag: tag || null,
        is_active: isActive,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("building_id", buildingId);

    if (error) {
      const message =
        error.code === "23505"
          ? "Ya existe un equipo con ese nombre en este building."
          : "No se pudo actualizar el equipo.";
      redirect(
        `/ops/buildings/${params.id}/equipment/${params.equipmentId}/edit?error=${encodeURIComponent(
          message
        )}`
      );
    }

    redirect(`/ops/buildings/${params.id}/equipment`);
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link
          href={`/ops/buildings/${building.id}/equipment`}
          className="text-sm text-gray-500"
        >
          ← Volver a equipos
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Editar equipo</h1>
        <p className="text-gray-600">{building.name}</p>
      </div>

      {searchParams?.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </div>
      ) : null}

      <form action={updateEquipment} className="max-w-xl space-y-4">
        <input type="hidden" name="id" value={equipment.id} />
        <input type="hidden" name="building_id" value={building.id} />
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            type="text"
            name="name"
            required
            defaultValue={equipment.name}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Tipo</label>
          <select
            name="equipment_type"
            required
            defaultValue={equipment.equipment_type}
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Selecciona un tipo</option>
            {EQUIPMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Marca</label>
          <input
            type="text"
            name="manufacturer"
            defaultValue={equipment.manufacturer ?? ""}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Modelo</label>
          <input
            type="text"
            name="model"
            defaultValue={equipment.model ?? ""}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Serial</label>
          <input
            type="text"
            name="serial"
            defaultValue={equipment.serial ?? ""}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Ubicación</label>
          <input
            type="text"
            name="location"
            defaultValue={equipment.location ?? ""}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Etiqueta</label>
          <input
            type="text"
            name="tag"
            defaultValue={equipment.tag ?? ""}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={equipment.notes ?? ""}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={equipment.is_active} />
          <span>Activo</span>
        </label>
        <div className="flex gap-3">
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">
            Guardar
          </button>
          <Link
            href={`/ops/buildings/${building.id}/equipment`}
            className="rounded border px-4 py-2 text-gray-700"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
