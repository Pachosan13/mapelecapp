import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import type { Role } from "@/types/database";

export async function requireRole(allowedRoles: Role[]) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.role) {
    redirect("/unauthorized");
  }

  if (!allowedRoles.includes(user.role)) {
    redirect("/unauthorized");
  }

  return { user };
}
