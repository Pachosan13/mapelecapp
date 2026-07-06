import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  pump: "Bombas",
  fire: "Incendio",
};

// Reordena un equipo dentro de su edificio intercambiando el sort_order con su
// vecino (arriba/abajo). El orden ya no es alfabético fijo: William lo acomoda.
async function moveEquipment(formData: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user || user.role === "director") {
    redirect("/ops/buildings");
  }
  const buildingId = String(formData.get("building_id") ?? "");
  const equipmentId = String(formData.get("equipment_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const supabase = await createClient();
  const db = supabase.schema("public");
  const { data: rows } = await db
    .from("equipment")
    .select("id,sort_order")
    .eq("building_id", buildingId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (rows && rows.length) {
    const idx = rows.findIndex((r) => r.id === equipmentId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx >= 0 && swapIdx >= 0 && swapIdx < rows.length) {
      const a = rows[idx];
      const b = rows[swapIdx];
      const aOrder = a.sort_order ?? (idx + 1) * 10;
      const bOrder = b.sort_order ?? (swapIdx + 1) * 10;
      await db.from("equipment").update({ sort_order: bOrder }).eq("id", a.id);
      await db.from("equipment").update({ sort_order: aOrder }).eq("id", b.id);
    }
  }
  revalidatePath(`/ops/buildings/${buildingId}/equipment`);
}

type SearchParams = {
  error?: string;
};

export default async function BuildingEquipmentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const isReadOnly = user.role === "director";
  const supabase = await createClient();
  const supabaseDb = supabase.schema("public");

  const { data: buildingData, error: buildingError } = await supabaseDb
    .from("buildings")
    .select("id,name,address")
    .eq("id", params.id)
    .maybeSingle();
  const building = buildingData;

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

  const { data: equipmentData, error: equipmentError } = await supabaseDb
    .from("equipment")
    .select("id,name,equipment_type,is_active,location,model,sort_order")
    .eq("building_id", params.id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  const equipment = equipmentData;

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/buildings" className="text-sm text-gray-500">
          ← Volver a buildings
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{building.name}</h1>
            <p className="text-gray-600">Inventario de equipos</p>
          </div>
          {!isReadOnly ? (
            <Link
              href={`/ops/buildings/${building.id}/equipment/new`}
              className="rounded bg-black px-4 py-2 text-white"
            >
              Agregar equipo
            </Link>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {building.address ?? "Sin dirección"}
        </p>
      </div>

      {searchParams?.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </div>
      ) : null}

      {equipmentError ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando equipos: {equipmentError.message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Ubicación</th>
              <th className="px-4 py-3 font-medium">Modelo</th>
              <th className="px-4 py-3 font-medium">Activo</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {equipment?.length ? (
              equipment.map((item, index) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {EQUIPMENT_TYPE_LABELS[item.equipment_type] ??
                      item.equipment_type}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.location ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.model ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.is_active ? "Sí" : "No"}
                  </td>
                  <td className="px-4 py-3">
                    {!isReadOnly ? (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col leading-none">
                          <form action={moveEquipment}>
                            <input type="hidden" name="building_id" value={building.id} />
                            <input type="hidden" name="equipment_id" value={item.id} />
                            <input type="hidden" name="direction" value="up" />
                            <button
                              type="submit"
                              disabled={index === 0}
                              title="Subir"
                              aria-label="Subir"
                              className="text-gray-500 hover:text-black disabled:opacity-25 disabled:cursor-not-allowed"
                            >
                              ▲
                            </button>
                          </form>
                          <form action={moveEquipment}>
                            <input type="hidden" name="building_id" value={building.id} />
                            <input type="hidden" name="equipment_id" value={item.id} />
                            <input type="hidden" name="direction" value="down" />
                            <button
                              type="submit"
                              disabled={index === (equipment?.length ?? 0) - 1}
                              title="Bajar"
                              aria-label="Bajar"
                              className="text-gray-500 hover:text-black disabled:opacity-25 disabled:cursor-not-allowed"
                            >
                              ▼
                            </button>
                          </form>
                        </div>
                        <Link
                          href={`/ops/buildings/${building.id}/equipment/${item.id}/edit`}
                          className="text-blue-600 hover:underline"
                        >
                          Editar
                        </Link>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={6}>
                  No hay equipos registrados para este building.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
