import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Category = NonNullable<
  Database["public"]["Tables"]["buildings"]["Row"]["systems"]
>[number];

const SYSTEM_OPTIONS = [
  { value: "pump", label: "Bombas" },
  { value: "fire", label: "Incendio" },
];

const ALLOWED_CATEGORY_SET = new Set<string>(["pump", "fire"]);

function toCategories(values: string[]): Category[] {
  return values.filter((v): v is Category => ALLOWED_CATEGORY_SET.has(v));
}

type SearchParams = {
  error?: string;
};

async function createBuilding(formData: FormData) {
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

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const systems = formData.getAll("systems").map(String);
  const systemsTyped = toCategories(systems);

  if (!name) {
    redirect("/ops/buildings/new?error=Nombre%20requerido");
  }

  if (systemsTyped.length === 0) {
    redirect("/ops/buildings/new?error=Selecciona%20al%20menos%20un%20sistema");
  }

  const { error } = await supabaseDb.from("buildings").insert({
    name,
    address: address || null,
    notes: notes || null,
    systems: systemsTyped,
    created_by: user.id,
  });

  if (error) {
    redirect(
      `/ops/buildings/new?error=${encodeURIComponent(
        "No se pudo crear el building."
      )}`
    );
  }

  redirect("/ops/buildings");
}

export default function NewBuildingPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/buildings" className="text-sm text-gray-500">
          ← Volver a buildings
        </Link>
        <h1 className="mt-2 text-2xl font-bold">New building</h1>
      </div>

      {searchParams?.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </div>
      ) : null}

      <form action={createBuilding} className="max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            type="text"
            name="name"
            required
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Address</label>
          <input
            type="text"
            name="address"
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            name="notes"
            rows={4}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Sistemas</p>
          <div className="space-y-2">
            {SYSTEM_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="systems" value={option.value} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">
            Create
          </button>
          <Link
            href="/ops/buildings"
            className="rounded border px-4 py-2 text-gray-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
