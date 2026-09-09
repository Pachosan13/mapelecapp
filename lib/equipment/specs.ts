import type { Database, Json } from "@/lib/database.types";
import { isFireSystem } from "../bombas/checklistFilter.ts";

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

/**
 * Claves de `specs` que NO son datos de placa y por lo tanto SOBREVIVEN a una edición.
 *
 * `buildSpecs` reconstruye el objeto entero a propósito: al cambiar el tipo de equipo, los
 * datos de placa del tipo viejo (los GPM de una bomba, por ejemplo) no aplican al nuevo. Pero
 * hay claves que no describen la placa sino al equipo, y borrarlas al editar es perder un dato
 * que nadie escribió dos veces.
 *
 * - `origen` — de qué hoja de mantenimiento salió el equipo. Es lo que permite revertir una
 *   carga mal leída por lote.
 * - `combustible` / `combustible_fuente` — si la bomba contra incendio es diésel, y quién lo
 *   dijo. Es una clasificación del equipo, no una medida de su placa: no cambia porque alguien
 *   corrija los HP.
 *
 * 🪤 **Por qué existe esta lista** (9-sep-2026): `combustible` no estaba, y bastó con que
 * William editara PH Costanera para que la marca de diésel desapareciera y con ella la sección
 * del manual Clarke de ese edificio — en silencio, sin error y sin que nadie lo notara. Una
 * clave nueva en `specs` que deba durar se agrega ACÁ, o se pierde en la primera edición.
 *
 * `verificado` NO está en la lista, a propósito: si alguien de SEMCO editó el equipo, ya lo miró.
 */
export const SPECS_CLAVES_PERSISTENTES = ["origen", "combustible", "combustible_fuente"] as const;

/**
 * Specs que se guardan al EDITAR: los datos de placa nuevos, más las claves persistentes que
 * ya traía el equipo.
 */
export function mergeSpecsAlEditar(
  specsPrevias: unknown,
  specsNuevas: Record<string, number | string>
): { [k: string]: Json | undefined } {
  const prev =
    typeof specsPrevias === "object" && specsPrevias !== null
      ? (specsPrevias as Record<string, Json>)
      : {};
  const out: { [k: string]: Json | undefined } = { ...specsNuevas };
  for (const k of SPECS_CLAVES_PERSISTENTES) {
    if (prev[k] !== undefined) out[k] = prev[k];
  }
  return out;
}

/** equipment_type legacy: "fire" para contra incendios (normada o no), "pump" para el resto. */
export function equipmentTypeFor(system: string): Category {
  return (isFireSystem(system) ? "fire" : "pump") as Category;
}
