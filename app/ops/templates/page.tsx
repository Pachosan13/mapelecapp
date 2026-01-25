import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function OpsTemplatesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visit_templates")
    .select("id,name,category,is_active,created_at")
    .order("created_at", { ascending: false });

  const templates = data ?? [];

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-gray-600">Plantillas de visita</p>
        </div>
        <Link
          href="/ops/templates/new"
          className="rounded bg-black px-4 py-2 text-white"
        >
          New
        </Link>
      </div>

      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando templates: {error.message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium">Items</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={4}>
                  No hay templates aún.
                </td>
              </tr>
            ) : (
              templates.map((template) => (
                <tr key={template.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{template.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {template.category}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {template.is_active ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/ops/templates/${template.id}/items`}
                      className="text-blue-600 hover:underline"
                    >
                      Manage items →
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
