import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DirectorOverviewPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "director") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Director</h1>
        <p className="text-gray-600">Overview general del sistema</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/dir/overview"
          className="rounded border p-4 transition hover:border-gray-400"
        >
          <h2 className="text-lg font-semibold">Overview</h2>
          <p className="text-sm text-gray-600">
            Métricas generales y estado operativo.
          </p>
        </Link>
        <Link
          href="/ops/buildings"
          className="rounded border p-4 transition hover:border-gray-400"
        >
          <h2 className="text-lg font-semibold">Buildings</h2>
          <p className="text-sm text-gray-600">
            Consultar el listado de PH/buildings.
          </p>
        </Link>
      </div>
    </div>
  );
}
