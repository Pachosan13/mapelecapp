import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/requireRole";

export default async function OpsLayout({ children }: { children: ReactNode }) {
  await requireRole(["ops_manager"]);

  return <>{children}</>;
}
