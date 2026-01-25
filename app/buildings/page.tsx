import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { listBuildings } from "@/lib/buildings/queries";

type SearchParams = {
  q?: string;
};

export default async function BuildingsReadOnlyPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (
    user.role !== "tech" &&
    user.role !== "director" &&
    user.role !== "ops_manager"
  ) {
    redirect("/unauthorized");
  }

  const query = searchParams?.q?.trim() ?? "";
  const { data: buildings, error } = await listBuildings(query);

  return (
    <div className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Buildings</h1>
          <p className="text-gray-600">Listado de PH/buildings</p>
        </div>
        <Link href="/" className="text-sm text-gray-500">
          ← Volver
        </Link>
      </div>

      <form className="mb-4" method="get">
        <div className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Buscar por nombre o dirección"
            className="w-full max-w-md rounded border px-3 py-2"
          />
          <button type="submit" className="rounded border px-4 py-2">
            Buscar
          </button>
        </div>
      </form>

      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando buildings: {error.message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {buildings.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={3}>
                  No hay buildings registrados.
                </td>
              </tr>
            ) : (
              buildings.map((building) => (
                <tr key={building.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{building.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {building.address ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(building.created_at).toLocaleDateString()}
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
