import { getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TechTodayPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "tech") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Tech - Hoy</h1>
      <p className="text-gray-600">Página placeholder para tech/today</p>
    </div>
  );
}
