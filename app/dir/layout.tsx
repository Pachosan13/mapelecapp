import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/requireRole";

export default async function DirLayout({ children }: { children: ReactNode }) {
  await requireRole(["director"]);

  return <>{children}</>;
}
