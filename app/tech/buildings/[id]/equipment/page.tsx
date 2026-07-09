import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listMedia } from "@/lib/media/service";

export const dynamic = "force-dynamic";

// Etiquetas legibles para el sistema del equipo (subtítulo). El código crudo
// (transferencia_agua_potable, etc.) es el mismo que precarga el levantamiento.
const SYSTEM_LABELS: Record<string, string> = {
  transferencia_agua_potable: "Transferencia agua potable",
  reforzador_agua_potable: "Reforzador agua potable",
  contra_incendios: "Contra incendios",
  achique_freatico: "Achique freático",
  achique_elevador: "Foso elevador",
  achique_pluvial: "Achique pluvial",
  sanitario: "Aguas sanitarias",
  planta_diesel: "Planta eléctrica",
};

const TYPE_LABELS: Record<string, string> = {
  pump: "Bomba",
  fire: "Contra incendio",
};

function systemLabel(system: string | null, type: string): string {
  if (system && SYSTEM_LABELS[system]) return SYSTEM_LABELS[system];
  if (system) return system.replace(/_/g, " ");
  return TYPE_LABELS[type] ?? type;
}

type SearchParams = { visit?: string };

export default async function TechBuildingEquipmentPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  const supabase = await createClient();
  const supabaseDb = supabase.schema("public");

  const { data: building, error: buildingError } = await supabaseDb
    .from("buildings")
    .select("id,name")
    .eq("id", params.id)
    .maybeSingle();

  if (buildingError) {
    return (
      <div className="min-h-screen p-6">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando edificio: {buildingError.message}
        </div>
      </div>
    );
  }
  if (!building) {
    notFound();
  }

  const { data: equipment, error: equipmentError } = await supabaseDb
    .from("equipment")
    .select("id,name,equipment_type,system,location,sort_order")
    .eq("building_id", params.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (equipmentError) {
    return (
      <div className="min-h-screen p-6">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando equipos: {equipmentError.message}
        </div>
      </div>
    );
  }

  // Conteo de fotos por equipo — una sola query del edificio, se cuenta en memoria.
  const { data: mediaRows } = await listMedia({
    buildingId: params.id,
    limit: 2000,
  });
  const photoCount = new Map<string, number>();
  for (const row of mediaRows ?? []) {
    if (!row.equipment_id) continue;
    photoCount.set(row.equipment_id, (photoCount.get(row.equipment_id) ?? 0) + 1);
  }

  const visitId = searchParams?.visit ?? "";
  const backHref = visitId ? `/tech/visits/${visitId}` : "/tech/today";
  const equipmentHref = (equipmentId: string) =>
    `/tech/buildings/${params.id}/equipment/${equipmentId}${
      visitId ? `?visit=${visitId}` : ""
    }`;

  const systemCount = new Set(
    (equipment ?? []).map((e) => e.system).filter(Boolean)
  ).size;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl">
        <Link href={backHref} className="text-sm text-slate-500">
          ← Volver
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900">{building.name}</h1>
        <p className="text-sm text-slate-500">
          {(equipment ?? []).length} equipos
          {systemCount ? ` · ${systemCount} sistemas` : ""} · inventario de fotos
        </p>

        <div className="mt-5 space-y-2.5">
          {(equipment ?? []).length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500">
              Este edificio todavía no tiene equipos registrados.
            </div>
          ) : (
            (equipment ?? []).map((eq) => {
              const count = photoCount.get(eq.id) ?? 0;
              return (
                <Link
                  key={eq.id}
                  href={equipmentHref(eq.id)}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-cyan-400 hover:shadow-sm"
                >
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-cyan-300">
                    {(TYPE_LABELS[eq.equipment_type] ?? eq.equipment_type)
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {eq.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {systemLabel(eq.system, eq.equipment_type)}
                      {eq.location ? ` · ${eq.location}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-1.5 text-xs font-semibold text-cyan-700">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zm8 3a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" />
                    </svg>
                    {count}
                  </span>
                  <span className="flex-shrink-0 text-slate-300">›</span>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
