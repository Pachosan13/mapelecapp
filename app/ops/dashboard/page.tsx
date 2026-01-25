import { getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function OpsDashboardPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ops_manager") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Ops Manager - Dashboard</h1>
      <p className="text-gray-600">Página placeholder para ops/dashboard</p>
    </div>
  );
}
