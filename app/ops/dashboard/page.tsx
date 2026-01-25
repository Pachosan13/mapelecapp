import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";

export default async function OpsDashboardPage() {
  await requireRole(["ops_manager"]);

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ops Manager</h1>
        <p className="text-gray-600">Accesos rápidos de operaciones</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Link
          href="/ops/buildings"
          className="rounded border bg-white p-4 transition hover:border-gray-500 hover:shadow-sm"
        >
          <h2 className="text-lg font-semibold">Buildings</h2>
          <p className="text-sm text-gray-600">
            Ver y gestionar el listado de PH/buildings.
          </p>
        </Link>
        <Link
          href="/ops/templates"
          className="rounded border bg-white p-4 transition hover:border-gray-500 hover:shadow-sm"
        >
          <h2 className="text-lg font-semibold">Templates</h2>
          <p className="text-sm text-gray-600">
            Administrar templates de formularios.
          </p>
        </Link>
        <Link
          href="/ops/visits/new"
          className="rounded border bg-white p-4 transition hover:border-gray-500 hover:shadow-sm"
        >
          <h2 className="text-lg font-semibold">New Visit</h2>
          <p className="text-sm text-gray-600">
            Crear una nueva visita programada.
          </p>
        </Link>
      </div>
    </div>
  );
}
