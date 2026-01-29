import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { listBuildings } from "@/lib/buildings/queries";

type SearchParams = {
  q?: string;
};

export default async function BuildingsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const query = searchParams?.q?.trim() ?? "";
  const { data: buildings, error } = await listBuildings(query);
  const isOpsManager = user.role === "ops_manager";

  return (
    <div className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Buildings</h1>
          <p className="text-gray-600">Listado de PH/buildings</p>
        </div>
        {isOpsManager ? (
          <Link
            href="/ops/buildings/new"
            className="rounded bg-black px-4 py-2 text-white"
          >
            New building
          </Link>
        ) : null}
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
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {buildings.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={4}>
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/ops/buildings/${building.id}/history`}
                        className="text-blue-600 hover:underline"
                      >
                        Historial
                      </Link>
                      <Link
                        href={`/ops/buildings/${building.id}/equipment`}
                        className="text-blue-600 hover:underline"
                      >
                        Equipos
                      </Link>
                      {isOpsManager ? (
                        <Link
                          href={`/ops/buildings/${building.id}/edit`}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </Link>
                      ) : null}
                    </div>
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
