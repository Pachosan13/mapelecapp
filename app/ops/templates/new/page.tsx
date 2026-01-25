import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  error?: string;
};

async function createTemplate(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!name || (category !== "pump" && category !== "fire")) {
    redirect("/ops/templates/new?error=Nombre%20y%20categor%C3%ADa%20requeridos");
  }

  const { error } = await supabase.from("visit_templates").insert({
    name,
    category,
    is_active: true,
  });

  if (error) {
    redirect(
      `/ops/templates/new?error=${encodeURIComponent(
        "No se pudo crear el template."
      )}`
    );
  }

  redirect("/ops/templates");
}

export default function NewTemplatePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/templates" className="text-sm text-gray-500">
          ← Volver a templates
        </Link>
        <h1 className="mt-2 text-2xl font-bold">New template</h1>
      </div>

      {searchParams?.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </div>
      ) : null}

      <form action={createTemplate} className="max-w-xl space-y-4">
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
          <label className="mb-1 block text-sm font-medium">Category</label>
          <select name="category" required className="w-full rounded border px-3 py-2">
            <option value="">Selecciona</option>
            <option value="pump">Pump</option>
            <option value="fire">Fire</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">
            Create
          </button>
          <Link
            href="/ops/templates"
            className="rounded border px-4 py-2 text-gray-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
