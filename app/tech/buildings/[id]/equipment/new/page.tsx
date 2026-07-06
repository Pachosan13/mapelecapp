import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EquipmentForm from "@/components/EquipmentForm";

type SearchParams = {
  error?: string;
  saved?: string;
  visit?: string;
};

export default async function TechNewEquipmentPage({
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
      <div className="min-h-screen p-8">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando edificio: {buildingError.message}
        </div>
      </div>
    );
  }
  if (!building) {
    notFound();
  }

  const visitId = searchParams?.visit ?? "";
  const backHref = visitId ? `/tech/visits/${visitId}` : "/tech/today";
  const formBase = `/tech/buildings/${params.id}/equipment/new`;

  async function createEquipment(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const supabaseDb = supabase.schema("public");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      redirect("/login");
    }

    const q = (extra: string) =>
      `${formBase}?${visitId ? `visit=${visitId}&` : ""}${extra}`;

    const buildingId = String(formData.get("building_id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const system = String(formData.get("system") ?? "").trim();
    const kind = String(formData.get("kind") ?? "").trim();
    const manufacturer = String(formData.get("manufacturer") ?? "").trim();
    const model = String(formData.get("model") ?? "").trim();
    const serial = String(formData.get("serial") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    const tag = String(formData.get("tag") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const isActive = formData.get("is_active") === "on";

    if (!buildingId || !name || !system || !kind) {
      redirect(q(`error=${encodeURIComponent("Nombre, sistema y tipo son requeridos.")}`));
    }

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

    const equipmentType = system === "contra_incendios" ? "fire" : "pump";

    // Los equipos nuevos entran al FINAL del inventario del edificio (max+10).
    const { data: lastRow } = await supabaseDb
      .from("equipment")
      .select("sort_order")
      .eq("building_id", buildingId)
      .order("sort_order", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const nextSortOrder = (lastRow?.sort_order ?? 0) + 10;

    const { error } = await supabaseDb.from("equipment").insert({
      building_id: buildingId,
      name,
      equipment_type: equipmentType,
      system,
      kind,
      specs,
      manufacturer: manufacturer || null,
      model: model || null,
      serial: serial || null,
      location: location || null,
      tag: tag || null,
      is_active: isActive,
      notes: notes || null,
      sort_order: nextSortOrder,
    });

    if (error) {
      redirect(
        q(
          `error=${encodeURIComponent(
            error.code === "23505"
              ? "Ya existe un equipo con ese nombre en este edificio."
              : "No se pudo crear el equipo."
          )}`
        )
      );
    }

    redirect(q("saved=1"));
  }

  return (
    <div className="min-h-screen p-8">
      <div className="-mx-8 -mt-8 mb-6 bg-slate-900 px-8 pb-5 pt-6 text-white">
        <a href={backHref} className="text-sm text-slate-300 hover:text-white">
          ← Volver a la visita
        </a>
        <h1 className="mt-2 text-2xl font-bold">Mapear equipos</h1>
        <p className="text-slate-300">{building.name}</p>
      </div>

      <EquipmentForm
        buildingId={building.id}
        action={createEquipment}
        cancelHref={backHref}
        doneHref={backHref}
        saved={searchParams?.saved === "1"}
        error={
          searchParams?.error ? decodeURIComponent(searchParams.error) : undefined
        }
      />
    </div>
  );
}
