import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createSignedMediaUrl, listMedia } from "@/lib/media/service";

export const dynamic = "force-dynamic";

// Mismas etiquetas que usa el gerente al subir (placa | vista_general | detalle).
const PHOTO_LABEL_MAP: Record<string, string> = {
  placa: "Placa / datos",
  vista_general: "Vista general",
  detalle: "Detalle / daño",
};

function labelText(label: string | null): string {
  if (!label) return "";
  return PHOTO_LABEL_MAP[label] ?? label;
}

type SearchParams = { visit?: string; label?: string };

export default async function TechEquipmentGalleryPage({
  params,
  searchParams,
}: {
  params: { id: string; equipmentId: string };
  searchParams?: SearchParams;
}) {
  const supabase = await createClient();
  const supabaseDb = supabase.schema("public");

  const { data: equipment, error: equipmentError } = await supabaseDb
    .from("equipment")
    .select("id,name,building_id,location")
    .eq("id", params.equipmentId)
    .eq("building_id", params.id)
    .maybeSingle();

  if (equipmentError) {
    return (
      <div className="min-h-screen p-6">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando equipo: {equipmentError.message}
        </div>
      </div>
    );
  }
  if (!equipment) {
    notFound();
  }

  const { data: building } = await supabaseDb
    .from("buildings")
    .select("id,name")
    .eq("id", params.id)
    .maybeSingle();

  const { data: mediaRows } = await listMedia({
    equipmentId: params.equipmentId,
    limit: 200,
  });
  const rows = mediaRows ?? [];

  // Chips de filtro: "Todas" + las etiquetas realmente presentes en este equipo.
  const labelsPresent = Array.from(
    new Set(rows.map((r) => r.label).filter((l): l is string => Boolean(l)))
  );
  const activeLabel = searchParams?.label ?? "";
  const visitId = searchParams?.visit ?? "";
  const listHref = `/tech/buildings/${params.id}/equipment${
    visitId ? `?visit=${visitId}` : ""
  }`;
  const chipHref = (label: string) => {
    const qs = new URLSearchParams();
    if (visitId) qs.set("visit", visitId);
    if (label) qs.set("label", label);
    const s = qs.toString();
    return `/tech/buildings/${params.id}/equipment/${params.equipmentId}${
      s ? `?${s}` : ""
    }`;
  };

  const visibleRows = activeLabel
    ? rows.filter((r) => r.label === activeLabel)
    : rows;

  const photos = await Promise.all(
    visibleRows.map(async (row) => {
      const { data: signedUrl } = await createSignedMediaUrl(row.storage_path);
      return { ...row, signed_url: signedUrl };
    })
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl">
        <Link href={listHref} className="text-sm text-slate-500">
          ← Equipos del edificio
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900">{equipment.name}</h1>
        <p className="text-sm text-slate-500">
          {building?.name}
          {equipment.location ? ` · ${equipment.location}` : ""} · {rows.length}{" "}
          {rows.length === 1 ? "foto" : "fotos"}
        </p>

        {labelsPresent.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={chipHref("")}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                activeLabel === ""
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              Todas
            </Link>
            {labelsPresent.map((label) => (
              <Link
                key={label}
                href={chipHref(label)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  activeLabel === label
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {labelText(label)}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-5">
          {photos.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              {rows.length === 0
                ? "Este equipo todavía no tiene fotos en el inventario."
                : "No hay fotos con esa etiqueta."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  {photo.signed_url ? (
                    photo.mime_type === "application/pdf" ? (
                      <a
                        href={photo.signed_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-36 items-center justify-center bg-slate-50 text-sm text-slate-600"
                      >
                        Ver PDF
                      </a>
                    ) : (
                      <a href={photo.signed_url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.signed_url}
                          alt={labelText(photo.label) || "Foto del equipo"}
                          loading="lazy"
                          className="h-36 w-full object-cover"
                        />
                      </a>
                    )
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-slate-50 text-xs text-slate-400">
                      (sin vista previa)
                    </div>
                  )}
                  {photo.label ? (
                    <div className="border-t border-slate-100 px-2 py-1.5 text-center text-[11px] font-semibold text-slate-600">
                      {labelText(photo.label)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
