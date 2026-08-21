import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { isRecorridoPorPisosItem } from "@/lib/reports/serviceReport";
import {
  buildBuildingScope,
  isBombasTemplate,
  itemAppliesToBuilding,
} from "@/lib/bombas/checklistFilter";
import {
  MEDIA_BUCKET,
  createSignedMediaUrl,
  listMedia,
} from "@/lib/media/service";
import { systemLabel } from "@/lib/equipment/systems";
import type { Database } from "@/lib/database.types";
import { fetchAllRows } from "@/lib/db/fetchAllRows";

// Borrado de evidencia por el gerente: para quitar fotos duplicadas o de otro proyecto
// ANTES de enviar el informe al cliente, sin depender de editar el PDF a mano.
// RLS deja borrar media a ops_manager/director; aquí además exigimos ese rol.
async function handleOpsMediaDelete(formData: FormData) {
  "use server";

  await requireRole(["ops_manager", "director"]);

  const supabase = await createClient();
  const visitId = String(formData.get("visit_id") ?? "");
  const mediaId = String(formData.get("media_id") ?? "");
  const reportHref = `/ops/visits/${visitId}/report`;
  if (!visitId || !mediaId) {
    redirect("/ops/visits");
  }

  const { data: mediaRow, error: readError } = await supabase
    .from("media")
    .select("id,visit_id,storage_path")
    .eq("id", mediaId)
    .eq("visit_id", visitId)
    .maybeSingle();

  if (readError || !mediaRow) {
    redirect(
      `${reportHref}?media_error=${encodeURIComponent(
        "No se encontró la evidencia."
      )}`
    );
  }

  // La fila primero (RLS valida el permiso); si negara, no tocamos el archivo.
  const { data: deleted, error: dbDeleteError } = await supabase
    .from("media")
    .delete()
    .eq("id", mediaId)
    .select("id");

  if (dbDeleteError) {
    redirect(
      `${reportHref}?media_error=${encodeURIComponent(dbDeleteError.message)}`
    );
  }
  if (!deleted?.length) {
    redirect(
      `${reportHref}?media_error=${encodeURIComponent(
        "No tienes permiso para borrar esta evidencia."
      )}`
    );
  }

  await supabase.storage.from(MEDIA_BUCKET).remove([mediaRow!.storage_path]);

  revalidatePath(reportHref);
  redirect(`${reportHref}?media_deleted=1`);
}

type TemplateItem = Pick<
  Database["public"]["Tables"]["template_items"]["Row"],
  "id" | "label" | "item_type" | "required" | "sort_order"
>;
type VisitResponse = Pick<
  Database["public"]["Tables"]["visit_responses"]["Row"],
  "item_id" | "value_text" | "value_number" | "value_bool" | "created_at"
>;

const PANAMA_TIME_ZONE = "America/Panama";

const formatPanamaDateTime = (value?: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PA", {
    timeZone: PANAMA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatResponseValue = (
  itemType: string,
  response?: VisitResponse,
  label?: string | null
): string => {
  if (!response) {
    return "—";
  }

  if (itemType === "checkbox") {
    // "Estado general del panel" usa Bueno/Regular/Malo (approved/na/failed). Va antes del
    // chequeo de null porque "Regular" ES el estado na y no debe leerse como "N/A".
    if ((label ?? "").trim().toLowerCase().endsWith("estado general del panel")) {
      if (response.value_bool === true) return "Bueno";
      if (response.value_bool === false) return "Malo";
      return response.value_text === "na" ? "Regular" : "—";
    }
    if (response.value_bool === null) {
      return response.value_text === "na" ? "N/A" : "—";
    }
    if ((label ?? "").trim().toLowerCase().endsWith("estado del foso")) {
      return response.value_bool ? "Aprobado" : "Requiere limpieza";
    }
    return response.value_bool ? "Sí" : "No";
  }

  if (itemType === "number") {
    return response.value_number !== null ? response.value_number.toString() : "—";
  }

  const trimmed = (response.value_text ?? "").trim();
  return trimmed || "—";
};

const formatBool = (value: boolean) => (value ? "Sí" : "No");

type RecorridoRow = {
  piso: string;
  presion_entrada: number | null;
  presion_salida: number | null;
  estacion_control_abierta: boolean;
  estacion_control_cerrada: boolean;
  valvula_reguladora: boolean;
  estado_manometro: boolean;
  gabinetes_manguera: boolean;
  extintores: boolean;
  observacion: string;
};

const looksLikeJson = (value: string) => {
  const trimmed = value.trim();
  return trimmed.startsWith("[") || trimmed.startsWith("{");
};

const normalizeRecorridoRow = (value: any): RecorridoRow | null => {
  if (!value || typeof value !== "object") return null;
  return {
    piso: typeof value.piso === "string" ? value.piso : "",
    presion_entrada:
      typeof value.presion_entrada === "number" &&
      Number.isFinite(value.presion_entrada)
        ? value.presion_entrada
        : null,
    presion_salida:
      typeof value.presion_salida === "number" &&
      Number.isFinite(value.presion_salida)
        ? value.presion_salida
        : null,
    estacion_control_abierta: Boolean(value.estacion_control_abierta),
    estacion_control_cerrada: Boolean(value.estacion_control_cerrada),
    valvula_reguladora: Boolean(value.valvula_reguladora),
    estado_manometro: Boolean(value.estado_manometro),
    gabinetes_manguera: Boolean(value.gabinetes_manguera),
    extintores: Boolean(value.extintores),
    observacion: typeof value.observacion === "string" ? value.observacion : "",
  };
};

const parseRecorridoRows = (value?: string | null): RecorridoRow[] | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((row) => normalizeRecorridoRow(row))
      .filter(Boolean) as RecorridoRow[];
  } catch {
    return null;
  }
};

export default async function OpsVisitReportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { media_deleted?: string; media_error?: string };
}) {
  const supabase = (await createClient()).schema("public");

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select(
      "id,building_id,template_id,scheduled_for,status,assigned_tech_user_id,assigned_crew_id,completed_at"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (visitError || !visit) {
    return (
      <div className="min-h-screen p-8">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {visitError
            ? `Error cargando reporte: ${visitError.message}`
            : "No se encontró la visita solicitada."}
        </div>
      </div>
    );
  }

  const { data: allTemplateItems } =
    visit.template_id
      ? await fetchAllRows((desde, hasta) =>
          supabase
            .from("template_items")
            .select("id,label,item_type,required,sort_order")
            .eq("template_id", visit.template_id!)
            .order("sort_order", { ascending: true })
            .range(desde, hasta)
        )
      : { data: [] };

  const { data: templateMeta } = visit.template_id
    ? await supabase
        .from("visit_templates")
        .select("name,category")
        .eq("id", visit.template_id)
        .maybeSingle()
    : { data: null };

  // Mismo filtro que ve el técnico y que sale en el PDF: el gerente no debe leer una pared
  // de "—" de secciones que el edificio no tiene (Jockey, Tablero, Planta…).
  // Sin equipos precargados → no se filtra.
  const { data: buildingEquipmentRows } = visit.building_id
    ? await supabase
        .from("equipment")
        .select("name,system,kind,location,specs")
        .eq("building_id", visit.building_id)
        .eq("is_active", true)
    : { data: [] };
  const buildingScope = buildBuildingScope(buildingEquipmentRows ?? []);
  const applyBuildingFilter =
    isBombasTemplate(templateMeta?.name, templateMeta?.category) &&
    buildingScope.systems.size > 0;
  const templateItems = applyBuildingFilter
    ? (allTemplateItems ?? []).filter((item) =>
        itemAppliesToBuilding(String(item.label ?? ""), buildingScope)
      )
    : allTemplateItems ?? [];

  const { data: responses } = await supabase
    .from("visit_responses")
    .select("item_id,value_text,value_number,value_bool,created_at")
    .eq("visit_id", visit.id);

  const { data: techProfiles } = visit.assigned_tech_user_id
    ? await supabase
        .from("profiles")
        .select("user_id,full_name")
        .eq("user_id", visit.assigned_tech_user_id)
    : { data: [] };

  const techName =
    techProfiles?.[0]?.full_name?.trim() ||
    (visit.assigned_tech_user_id
      ? `Usuario ${visit.assigned_tech_user_id.slice(0, 6)}`
      : "—");

  const latestResponseByItemId = new Map<string, VisitResponse>();
  (responses ?? []).forEach((response: VisitResponse) => {
    if (!response.item_id) return;
    if (!response.created_at) return;
    const existing = latestResponseByItemId.get(response.item_id);
    if (!existing) {
      latestResponseByItemId.set(response.item_id, response);
      return;
    }
    if (!existing.created_at) return;
    if (new Date(response.created_at) > new Date(existing.created_at)) {
      latestResponseByItemId.set(response.item_id, response);
    }
  });

  const { data: buildingRow } = visit.building_id
    ? await supabase
        .from("buildings")
        .select("name")
        .eq("id", visit.building_id)
        .maybeSingle()
    : { data: null };

  const buildingName = buildingRow?.name?.trim() || "Building";
  const templateName =
    templateMeta?.name?.trim() ||
    (visit.template_id ? `Template ${visit.template_id.slice(0, 8)}` : "Formulario");
  const buildingHref = visit.building_id
    ? `/ops/buildings/${visit.building_id}/history`
    : "/ops/buildings";
  const { data: mediaRows } = await listMedia({ visitId: visit.id, limit: 50 });
  // 8 horas, no 15 minutos. El enlace se firmaba al pintar la página, así que un
  // gerente que dejaba el informe abierto y volvía al rato encontraba "Ver archivo"
  // muerto — se leía como que el archivo había desaparecido (William, 6-ago-2026).
  const MEDIA_URL_TTL_SECONDS = 60 * 60 * 8;
  const mediaWithUrls = await Promise.all(
    (mediaRows ?? []).map(async (row) => {
      const { data: signedUrl } = await createSignedMediaUrl(
        row.storage_path,
        MEDIA_URL_TTL_SECONDS
      );
      return {
        ...row,
        signed_url: signedUrl,
      };
    })
  );

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href={buildingHref} className="text-sm text-gray-500">
          ← Volver al historial del building
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Reporte de visita</h1>
        <p className="text-gray-600">
          {buildingName} · {templateName}
        </p>
        {/* Los botones del PDF vivían solo en /ops/visits/[id] y en el informe por
            edificio. Esta pantalla —la que se abre desde el historial y la que el
            gerente tiene delante cuando revisa la evidencia— no tenía ninguno, así que
            desde acá no había forma de llegar al PDF. William, 7-ago: "de este que se
            realizo el 6 no me sale" — la visita estaba completa y el PDF generaba bien;
            estaba parado en la pantalla que no los traía. */}
        {visit.status === "completed" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={`/api/reports/service-report?visitId=${visit.id}&view=1`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              Ver reporte
            </a>
            <a
              href={`/api/reports/service-report?visitId=${visit.id}`}
              className="inline-flex rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              Descargar reporte (PDF)
            </a>
          </div>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 rounded border p-4 text-sm text-gray-700 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-gray-500">Building</p>
          <p className="text-sm font-medium">{buildingName}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Formulario</p>
          <p className="text-sm font-medium">{templateName}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Tech</p>
          <p className="text-sm font-medium">{techName}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Completado</p>
          <p className="text-sm font-medium">
            {formatPanamaDateTime(visit.completed_at)}
          </p>
        </div>
      </div>

      <div className="mb-6 rounded border p-4">
        <div className="mb-2 text-sm font-semibold text-gray-700">
          Observaciones del técnico
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">—</p>
      </div>

      <div className="mb-6 rounded border p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-700">Evidencia</div>
          {mediaWithUrls.length > 0 ? (
            <span className="text-xs text-gray-400">
              Elimina fotos duplicadas o de otro proyecto antes de enviar al cliente
            </span>
          ) : null}
        </div>
        {searchParams?.media_deleted ? (
          <div className="mb-3 rounded border border-green-100 bg-green-50/70 px-3 py-2 text-xs font-medium text-green-800">
            Foto eliminada ✅
          </div>
        ) : null}
        {searchParams?.media_error ? (
          <div className="mb-3 rounded border border-red-100 bg-red-50/70 px-3 py-2 text-xs text-red-700">
            {searchParams.media_error}
          </div>
        ) : null}
        {mediaWithUrls.length === 0 ? (
          <p className="text-sm text-gray-500">Sin evidencia para esta visita.</p>
        ) : (
          <ul className="space-y-2">
            {mediaWithUrls.map((media) => (
              <li
                key={media.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  {/* El sistema primero: el nombre del archivo es un UUID que no le
                      dice nada a nadie. Sin esto no se podía saber si el manómetro
                      de la foto era de las bombas principales o de la reforzadora. */}
                  {media.kind === "signature" ? (
                    <p className="font-medium">Firma de recibido</p>
                  ) : media.system ? (
                    <p className="font-medium">{systemLabel(media.system)}</p>
                  ) : (
                    <p className="font-medium text-amber-700">
                      Sistema sin especificar
                    </p>
                  )}
                  {media.label ? (
                    <p className="truncate text-xs text-gray-600">{media.label}</p>
                  ) : null}
                  <p className="truncate text-xs text-gray-500">
                    {media.storage_path.split("/").pop()} · {media.mime_type} ·{" "}
                    {(media.size_bytes / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {media.signed_url ? (
                    <a
                      href={media.signed_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border px-3 py-1.5 text-xs"
                    >
                      Ver archivo
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">Sin enlace</span>
                  )}
                  <form action={handleOpsMediaDelete}>
                    <input type="hidden" name="visit_id" value={visit.id} />
                    <input type="hidden" name="media_id" value={media.id} />
                    <button
                      type="submit"
                      className="rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* DOS columnas, no tres (5-ago-2026). La columna "Tipo" mostraba jerga
          interna —`number`, `checkbox`, `textarea`— que a un gerente no le dice
          nada, y en un teléfono de 390px empujaba la columna "Valor" fuera de la
          pantalla: se veía el ítem y NO la respuesta. `table-fixed` con anchos
          obliga a que la etiqueta larga se parta en vez de ensanchar la tabla,
          en vez de dejarlo al scroll horizontal (mismo criterio que el arreglo
          de la vista previa del formato, 2-ago). */}
      <div className="rounded border">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="w-3/5 px-4 py-3 font-medium">Item</th>
              <th className="w-2/5 px-4 py-3 font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {(templateItems ?? []).length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={2}>
                  No hay items configurados para esta plantilla.
                </td>
              </tr>
            ) : (
              (templateItems ?? []).map((item: TemplateItem) => {
                const response = latestResponseByItemId.get(item.id);
                const isRecorridoItem = isRecorridoPorPisosItem(item.label);
                const rawText = (response?.value_text ?? "").trim();
                const recorridoRows = isRecorridoItem
                  ? parseRecorridoRows(rawText)
                  : null;
                const fallbackText = rawText
                  ? looksLikeJson(rawText)
                    ? "—"
                    : rawText
                  : "—";
                // La tabla nace con 70 filas (un edificio de 70 pisos es el tope,
                // no la norma). Imprimir los pisos que nadie registró son decenas
                // de filas de "—" entre el gerente y el resto del informe, y en un
                // teléfono es media pantalla de nada. Se muestran solo los que
                // tienen algo, y se DICE cuántos quedaron fuera: ocultar en
                // silencio se leería como "el técnico solo revisó 8 pisos".
                const recorridoConRegistro = recorridoRows?.filter(
                  (r) =>
                    r.presion_entrada !== null ||
                    r.presion_salida !== null ||
                    r.observacion.trim() !== "" ||
                    r.estacion_control_abierta ||
                    r.estacion_control_cerrada ||
                    r.valvula_reguladora ||
                    r.estado_manometro ||
                    r.gabinetes_manguera ||
                    r.extintores
                );
                const recorridoSinRegistro =
                  (recorridoRows?.length ?? 0) - (recorridoConRegistro?.length ?? 0);

                // El recorrido son 10 columnas: no cabe metido en una celda de
                // 2/5 de ancho. Va en su propia fila, a lo ancho de la tabla.
                if (recorridoRows && recorridoConRegistro) {
                  return (
                    <Fragment key={item.id}>
                      <tr className="border-t align-top">
                        <td
                          className="break-words px-4 pb-1 pt-3 font-medium"
                          colSpan={2}
                        >
                          {/* La etiqueta de este ítem trae los encabezados
                              pegados con "|" ("Recorrido por pisos - Piso |
                              Presión entrada (psi) | …"): en el teléfono son
                              seis líneas de ruido justo encima de la tabla que
                              ya muestra esos mismos encabezados. */}
                          {item.label
                            .split("|")[0]
                            .replace(/\s*-\s*Piso\s*$/i, "")
                            .trim()}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 pb-3 text-gray-700" colSpan={2}>
                          <div className="overflow-x-auto rounded border">
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-gray-50 text-gray-600">
                              <tr>
                                <th className="px-3 py-2 font-medium">Piso</th>
                                <th className="px-3 py-2 font-medium">
                                  Presión entrada
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Presión salida
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Estación control abierta
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Estación control cerrada
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Válvula reguladora
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Estado manómetro
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Gabinetes/manguera
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Extintores
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Observación
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {recorridoConRegistro.length === 0 ? (
                                <tr className="border-t">
                                  <td
                                    className="px-3 py-3 text-gray-500"
                                    colSpan={10}
                                  >
                                    Sin filas.
                                  </td>
                                </tr>
                              ) : null}
                              {recorridoConRegistro.map((row, index) => (
                                <tr key={`${item.id}-${index}`} className="border-t">
                                  <td className="px-3 py-2">{row.piso || "—"}</td>
                                  <td className="px-3 py-2">
                                    {row.presion_entrada ?? "—"}
                                  </td>
                                  <td className="px-3 py-2">
                                    {row.presion_salida ?? "—"}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatBool(row.estacion_control_abierta)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatBool(row.estacion_control_cerrada)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatBool(row.valvula_reguladora)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatBool(row.estado_manometro)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatBool(row.gabinetes_manguera)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {formatBool(row.extintores)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {row.observacion || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                          {recorridoSinRegistro > 0 ? (
                            <p className="mt-2 text-xs text-gray-500">
                              {recorridoSinRegistro === 1
                                ? "1 piso más sin registro (no se muestra)."
                                : `${recorridoSinRegistro} pisos más sin registro (no se muestran).`}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    </Fragment>
                  );
                }

                return (
                  <tr key={item.id} className="border-t align-top">
                    <td className="break-words px-4 py-3 font-medium">
                      {item.label}
                    </td>
                    <td className="break-words px-4 py-3 text-gray-700">
                      {isRecorridoItem
                        ? fallbackText
                        : formatResponseValue(item.item_type, response, item.label)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
