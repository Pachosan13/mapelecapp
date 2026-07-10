import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient } from "@/lib/supabase/server";
import {
  MEDIA_BUCKET,
  createSignedMediaUrl,
  listMedia,
  uploadMedia,
} from "@/lib/media/service";
import type { Database } from "@/lib/database.types";
import DeleteEquipmentButton from "./DeleteEquipmentButton";
import EquipmentPhotoUpload from "./EquipmentPhotoUpload";

export const dynamic = "force-dynamic";

type Category = Database["public"]["Tables"]["equipment"]["Row"]["equipment_type"];

const EQUIPMENT_TYPE_OPTIONS = [
  { value: "pump", label: "Bombas" },
  { value: "fire", label: "Incendio" },
];

const ALLOWED_CATEGORY_SET = new Set<string>(["pump", "fire"]);

// Etiqueta por foto — clasifica la evidencia DENTRO del equipo (placa vs vista vs daño).
const PHOTO_LABEL_OPTIONS = [
  { value: "placa", label: "Placa / datos" },
  { value: "vista_general", label: "Vista general" },
  { value: "detalle", label: "Detalle o daño" },
];
const PHOTO_LABEL_MAP: Record<string, string> = {
  placa: "Placa",
  vista_general: "Vista general",
  detalle: "Detalle/daño",
};

function toCategory(value: string): Category | undefined {
  return ALLOWED_CATEGORY_SET.has(value) ? (value as Category) : undefined;
}

type SearchParams = {
  error?: string;
  media_error?: string;
  media_saved?: string;
  created?: string;
};

export default async function EditEquipmentPage({
  params,
  searchParams,
}: {
  params: { id: string; equipmentId: string };
  searchParams?: SearchParams;
}) {
  const supabase = await createClient();
  const supabaseDb = supabase.schema("public");

  const { data: equipmentData, error: equipmentError } = await supabaseDb
    .from("equipment")
    .select(
      "id,building_id,name,equipment_type,is_active,manufacturer,model,serial,location,tag,notes"
    )
    .eq("id", params.equipmentId)
    .eq("building_id", params.id)
    .maybeSingle();
  const equipment = equipmentData;

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

  const { data: buildingData, error: buildingError } = await supabaseDb
    .from("buildings")
    .select("id,name")
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

  async function updateEquipment(formData: FormData) {
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

    const id = String(formData.get("id") ?? "");
    const buildingId = String(formData.get("building_id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const equipmentType = String(formData.get("equipment_type") ?? "").trim();
    const equipmentTypeTyped = toCategory(equipmentType);
    const manufacturer = String(formData.get("manufacturer") ?? "").trim();
    const model = String(formData.get("model") ?? "").trim();
    const serial = String(formData.get("serial") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    const tag = String(formData.get("tag") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const isActive = formData.get("is_active") === "on";

    if (!id || !buildingId || !name || !equipmentTypeTyped) {
      redirect(
        `/ops/buildings/${params.id}/equipment/${params.equipmentId}/edit?error=${encodeURIComponent(
          "Nombre y tipo son requeridos."
        )}`
      );
    }

    const { error } = await supabaseDb
      .from("equipment")
      .update({
        name,
        equipment_type: equipmentTypeTyped,
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

  async function deleteEquipment(formData: FormData) {
    "use server";

    await requireRole(["ops_manager", "director"]);

    const supabase = await createClient();
    const supabaseDb = supabase.schema("public");

    const id = String(formData.get("id") ?? "");
    const buildingId = String(formData.get("building_id") ?? "");

    const { data: deleted, error } = await supabaseDb
      .from("equipment")
      .delete()
      .eq("id", id)
      .eq("building_id", buildingId)
      .select("id");

    if (error) {
      // Las FK a equipment (fotos, respuestas) son ON DELETE SET NULL, así que
      // 23503 no debería pasar; se maneja por seguridad.
      const message =
        error.code === "23503"
          ? "Este equipo tiene registros asociados y no se puede borrar."
          : "No se pudo borrar el equipo.";
      redirect(
        `/ops/buildings/${params.id}/equipment/${params.equipmentId}/edit?error=${encodeURIComponent(
          message
        )}`
      );
    }

    // Un DELETE negado por RLS no lanza error: devuelve cero filas. Sin este
    // chequeo la redirección de éxito mentiría y el equipo seguiría ahí.
    if (!deleted?.length) {
      redirect(
        `/ops/buildings/${params.id}/equipment/${params.equipmentId}/edit?error=${encodeURIComponent(
          "No se pudo borrar el equipo: no existe o no tienes permiso."
        )}`
      );
    }

    redirect(`/ops/buildings/${params.id}/equipment`);
  }

  // Fotos por equipo (feedback William 1-jul): subir varias, se acumulan.
  async function handleEquipmentMediaUpload(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      redirect("/login");
    }

    const base = `/ops/buildings/${params.id}/equipment/${params.equipmentId}/edit`;
    const files = formData
      .getAll("media_file")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) {
      redirect(`${base}?media_error=${encodeURIComponent("Selecciona al menos una foto.")}`);
    }

    // Etiqueta (placa | vista_general | detalle) — se aplica a todas las fotos del lote.
    const label = String(formData.get("media_label") ?? "").trim() || null;

    for (const file of files) {
      const { error } = await uploadMedia({
        buildingId: params.id,
        equipmentId: params.equipmentId,
        file,
        kind: "evidence",
        label,
      });
      if (error) {
        redirect(`${base}?media_error=${encodeURIComponent(error)}`);
      }
    }

    redirect(`${base}?media_saved=1`);
  }

  async function handleEquipmentMediaDelete(formData: FormData) {
    "use server";

    await requireRole(["ops_manager", "director"]);

    const supabase = await createClient();

    const base = `/ops/buildings/${params.id}/equipment/${params.equipmentId}/edit`;
    const mediaId = String(formData.get("media_id") ?? "");
    if (!mediaId) {
      redirect(base);
    }

    const { data: mediaRow } = await supabase
      .from("media")
      .select("id,storage_path,equipment_id")
      .eq("id", mediaId)
      .eq("equipment_id", params.equipmentId)
      .maybeSingle();
    if (!mediaRow) {
      redirect(`${base}?media_error=${encodeURIComponent("No se encontró la foto.")}`);
    }

    // La fila primero: es la que RLS protege. Si el objeto se borrara antes y el
    // DELETE resultara negado, el archivo se perdería con la fila aún apuntándolo.
    const { data: deleted, error: deleteError } = await supabase
      .from("media")
      .delete()
      .eq("id", mediaId)
      .select("id");
    if (deleteError) {
      redirect(`${base}?media_error=${encodeURIComponent(deleteError.message)}`);
    }
    if (!deleted?.length) {
      redirect(
        `${base}?media_error=${encodeURIComponent("No tienes permiso para borrar esta foto.")}`
      );
    }

    await supabase.storage.from(MEDIA_BUCKET).remove([mediaRow.storage_path]);

    redirect(`${base}?media_saved=1`);
  }

  const { data: mediaRows } = await listMedia({
    equipmentId: params.equipmentId,
    limit: 50,
  });
  const photos = await Promise.all(
    (mediaRows ?? []).map(async (row) => {
      const { data: signedUrl } = await createSignedMediaUrl(row.storage_path);
      return { ...row, signed_url: signedUrl };
    })
  );

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

      {searchParams?.created ? (
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Equipo creado ✅ Ahora súbele las fotos abajo (placa, tablero, vista
          general…).
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

      {/* Eliminar equipo — feedback William (6-jul): borrar un equipo mal agregado */}
      <div className="mt-8 max-w-xl border-t border-red-200 pt-6">
        <h2 className="text-lg font-semibold text-red-700">Eliminar equipo</h2>
        <p className="mt-1 text-sm text-gray-500">
          Quita este equipo del inventario del edificio. Esta acción no se puede
          deshacer.
        </p>
        <form action={deleteEquipment} className="mt-4">
          <input type="hidden" name="id" value={equipment.id} />
          <input type="hidden" name="building_id" value={building.id} />
          <DeleteEquipmentButton className="rounded border border-red-300 bg-red-50 px-4 py-2 text-red-700 hover:bg-red-100" />
        </form>
      </div>

      {/* Fotos del equipo — feedback William (1-jul): foto por equipo, se acumulan */}
      <div className="mt-8 max-w-xl border-t pt-6">
        <h2 className="text-lg font-semibold">Fotos del equipo</h2>
        <p className="mt-1 text-sm text-gray-500">
          Sube fotos de este equipo (bomba, tablero, placa…). Se acumulan aquí.
          JPG, PNG o iPhone. Máx. 10MB c/u.
        </p>

        {searchParams?.media_error ? (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {decodeURIComponent(searchParams.media_error)}
          </div>
        ) : null}
        {searchParams?.media_saved ? (
          <div className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            Fotos guardadas ✅
          </div>
        ) : null}

        <EquipmentPhotoUpload
          action={handleEquipmentMediaUpload}
          labelOptions={PHOTO_LABEL_OPTIONS}
        />

        <div className="mt-5">
          {photos.length === 0 ? (
            <p className="text-sm text-gray-500">Sin fotos todavía.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) => (
                <div key={photo.id} className="overflow-hidden rounded border">
                  {photo.signed_url ? (
                    photo.mime_type === "application/pdf" ? (
                      <a
                        href={photo.signed_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-32 items-center justify-center bg-slate-50 text-sm text-slate-600"
                      >
                        Ver PDF
                      </a>
                    ) : (
                      <a href={photo.signed_url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.signed_url}
                          alt="Foto del equipo"
                          className="h-32 w-full object-cover"
                        />
                      </a>
                    )
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-slate-50 text-xs text-slate-400">
                      (sin vista previa)
                    </div>
                  )}
                  {photo.label ? (
                    <div className="border-t px-2 py-1 text-center text-[11px] font-medium text-slate-600">
                      {PHOTO_LABEL_MAP[photo.label] ?? photo.label}
                    </div>
                  ) : null}
                  <form action={handleEquipmentMediaDelete} className="border-t">
                    <input type="hidden" name="media_id" value={photo.id} />
                    <button
                      type="submit"
                      className="w-full px-2 py-1.5 text-xs text-red-700 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
