import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/requireRole";

/**
 * Vista de Facturación: solo lectura. Entra el rol `facturacion` (contabilidad) y,
 * para poder verla igual que ellos, los gerentes y el director.
 */
export default async function FactLayout({ children }: { children: ReactNode }) {
  await requireRole(["facturacion", "ops_manager", "director"]);

  return <>{children}</>;
}
