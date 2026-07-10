import type { Database } from "@/lib/database.types";

type Category = Database["public"]["Tables"]["equipment"]["Row"]["equipment_type"];

/**
 * Datos de placa (columna specs JSONB) según el tipo de equipo.
 * Crear y editar leen de aquí para que los campos no se desincronicen.
 */
export function buildSpecs(formData: FormData, kind: string): Record<string, number | string> {
  const numOf = (k: string): number | null => {
    const raw = formData.get(k);
    if (raw == null || String(raw).trim() === "") return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  };

  const specs: Record<string, number | string> = {};
  const put = (k: string, v: number | string | null) => {
    if (v != null) specs[k] = v;
  };

  if (kind === "bomba") {
    put("hp", numOf("hp"));
    put("voltage", numOf("voltage"));
    put("pressure_psi", numOf("pressure_psi"));
    put("flow_gpm", numOf("flow_gpm"));
  } else if (kind === "panel_control") {
    const st = String(formData.get("starter_type") ?? "").trim();
    if (st) specs.starter_type = st;
    put("power", numOf("power"));
    put("voltage", numOf("voltage"));
  } else if (kind === "generador") {
    put("kva", numOf("kva"));
    put("kw", numOf("kw"));
    put("current_a", numOf("current_a"));
    put("voltage", numOf("voltage"));
  }

  return specs;
}

/** equipment_type legacy: "fire" para contra incendios, "pump" para el resto. */
export function equipmentTypeFor(system: string): Category {
  return (system === "contra_incendios" ? "fire" : "pump") as Category;
}
