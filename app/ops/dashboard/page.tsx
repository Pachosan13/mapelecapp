import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";

export default async function OpsDashboardPage() {
  await requireRole(["ops_manager"]);

  return (
    <div className="min-h-screen bg-gray-50/40 p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Hoy</h1>
        <p className="text-sm text-gray-500">Panel operativo</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/ops/visits"
          className="rounded-xl border border-transparent bg-white p-4 transition hover:border-gray-200 hover:shadow-sm"
        >
          <h2 className="text-base font-semibold text-gray-900">Hoy</h2>
          <p className="text-sm text-gray-500">Visitas de hoy</p>
        </Link>
        <Link
          href="/ops/buildings"
          className="rounded-xl border border-transparent bg-white p-4 transition hover:border-gray-200 hover:shadow-sm"
        >
          <h2 className="text-base font-semibold text-gray-900">Edificios</h2>
          <p className="text-sm text-gray-500">Gestionar PH/buildings</p>
        </Link>
      </div>
    </div>
  );
}
