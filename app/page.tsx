import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function Home() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }
  
  // Redirect based on user role
  if (user.role === "ops_manager") {
    redirect("/ops/dashboard");
  } else if (user.role === "director") {
    redirect("/dir/overview");
  } else {
    // Default to tech dashboard
    redirect("/tech/today");
  }
}
