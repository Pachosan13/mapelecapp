import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const CATEGORY_LABELS: Record<string, string> = {
  pump: "Bombas",
  fire: "Incendio",
};

export default async function OpsTemplatesPage() {
  const supabase = (await createClient()).schema("public");
  const { data, error } = await supabase
    .from("visit_templates")
    .select("id,name,category,is_active,created_at")
    .order("created_at", { ascending: false });

  const templates = data ?? [];

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Formularios</h1>
          <p className="text-gray-600">Formularios de visita</p>
        </div>
        <Link
          href="/ops/templates/new"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Nuevo
        </Link>
      </div>

      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando formularios: {error.message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Activo</th>
              <th className="px-4 py-3 font-medium">Campos</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={4}>
                  No hay formularios aún.
                </td>
              </tr>
            ) : (
              templates.map((template) => (
                <tr key={template.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{template.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {CATEGORY_LABELS[template.category] ?? template.category}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {template.is_active ? "Sí" : "No"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/ops/templates/${template.id}/items`}
                      className="text-blue-600 hover:underline"
                    >
                      Ver campos →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
