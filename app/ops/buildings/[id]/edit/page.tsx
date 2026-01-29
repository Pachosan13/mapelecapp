import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getBuildingById } from "@/lib/buildings/queries";
import DeleteButton from "./DeleteButton";

const SYSTEM_OPTIONS = [
  { value: "pump", label: "Bombas" },
  { value: "fire", label: "Incendio" },
];

type SearchParams = {
  error?: string;
};

async function updateBuilding(formData: FormData) {
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
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const systems = formData
    .getAll("systems")
    .map((value) => String(value))
    .filter((value) => SYSTEM_OPTIONS.some((option) => option.value === value));

  if (!name) {
    redirect(`/ops/buildings/${id}/edit?error=Nombre%20requerido`);
  }

  if (systems.length === 0) {
    redirect(
      `/ops/buildings/${id}/edit?error=Selecciona%20al%20menos%20un%20sistema`
    );
  }

  const { error } = await supabase
    .from("buildings")
    .update({
      name,
      address: address || null,
      notes: notes || null,
      systems,
    })
    .eq("id", id);

  if (error) {
    redirect(
      `/ops/buildings/${id}/edit?error=${encodeURIComponent(
        "No se pudo actualizar el building."
      )}`
    );
  }

  redirect("/ops/buildings");
}

async function deleteBuilding(formData: FormData) {
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

  const { error } = await supabase.from("buildings").delete().eq("id", id);

  if (error) {
    redirect(
      `/ops/buildings/${id}/edit?error=${encodeURIComponent(
        "No se pudo borrar el building."
      )}`
    );
  }

  redirect("/ops/buildings");
}

export default async function EditBuildingPage({
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

  const { data: building, error } = await getBuildingById(params.id);

  if (error) {
    return (
      <div className="min-h-screen p-8">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando building: {error.message}
        </div>
      </div>
    );
  }

  if (!building) {
    notFound();
  }

  const currentSystems = building.systems ?? [];

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/buildings" className="text-sm text-gray-500">
          ← Volver a buildings
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Edit building</h1>
      </div>

      {searchParams?.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </div>
      ) : null}

      <form action={updateBuilding} className="max-w-xl space-y-4">
        <input type="hidden" name="id" value={building.id} />
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            type="text"
            name="name"
            required
            defaultValue={building.name}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Address</label>
          <input
            type="text"
            name="address"
            defaultValue={building.address ?? ""}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            name="notes"
            rows={4}
            defaultValue={building.notes ?? ""}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Sistemas</p>
          <div className="space-y-2">
            {SYSTEM_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="systems"
                  value={option.value}
                  defaultChecked={currentSystems.includes(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {currentSystems.length === 0 ? (
            <p className="mt-2 text-xs text-amber-600">
              Este building no tiene sistemas configurados (pump/fire).
            </p>
          ) : null}
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">
            Save
          </button>
          <Link
            href="/ops/buildings"
            className="rounded border px-4 py-2 text-gray-700"
          >
            Cancel
          </Link>
        </div>
      </form>

      <form action={deleteBuilding} className="mt-8">
        <input type="hidden" name="id" value={building.id} />
        <DeleteButton className="rounded border border-red-500 px-4 py-2 text-red-600" />
      </form>
    </div>
  );
}
