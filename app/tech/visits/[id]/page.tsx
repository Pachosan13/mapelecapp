import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { isCoreChecklistTemplateId } from "@/lib/constants/coreChecklist";
import {
  groupOf,
  buildBuildingScope,
  itemAppliesToBuilding,
  isBombasTemplate,
  EMPTY_SCOPE,
  type BuildingScope,
} from "@/lib/bombas/checklistFilter";
import {
  MEDIA_BUCKET,
  createSignedMediaUrl,
  listMedia,
  uploadMedia,
  type SignerRole,
} from "@/lib/media/service";
import StartVisitButton from "./StartVisitButton";
import AutosaveManager from "./AutosaveManager";
import VisitToast from "./VisitToast";
import RecorridoTable from "./RecorridoTable";
import CompleteVisitButton from "./CompleteVisitButton";
import OfflinePhotoCapture from "./OfflinePhotoCapture";
import SignaturePad from "./SignaturePad";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  error?: string;
  saved?: string;
  media_error?: string;
  media_saved?: string;
  signature_saved?: string;
};

type TemplateItem = Pick<
  Database["public"]["Tables"]["template_items"]["Row"],
  "id" | "label" | "item_type" | "required" | "sort_order"
>;
type VisitLatestResponse = Pick<
  Database["public"]["Views"]["visit_latest_responses"]["Row"],
  "item_id" | "value_text" | "value_number" | "value_bool"
>;

const isRecorridoPorPisosLabel = (label?: string | null) =>
  (label ?? "").trim().toLowerCase().startsWith("recorrido por pisos");

// Presurización de escaleras usa el mismo estilo de checklist (Aprobado/Falla/N/A)
// pero sin la lista de equipos de bombeo.
const isEscalerasTemplate = (templateName?: string | null) => {
  const n = (templateName ?? "").trim().toLowerCase();
  return n.includes("presurización de escaleras") || n.includes("presurizacion de escaleras");
};

// "Estado del foso" usa opciones propias (Aprobado / Requiere limpieza) en vez de
// Aprobado/Falla/N/A. El valor guardado sigue siendo approved/failed/na para no romper
// validación ni almacenamiento — solo cambian las etiquetas visibles.
const isEstadoFosoLabel = (label?: string | null) =>
  (label ?? "").trim().toLowerCase().endsWith("estado del foso");

// "Estado general del panel" (paneles de control BCI/Jockey) usa Bueno/Regular/Malo en vez
// de Aprobado/Falla/N/A. Se guarda igual (approved/failed/na → value_bool true/false/null)
// para no romper validación ni almacenamiento; solo cambian las etiquetas visibles.
const isEstadoGeneralPanelLabel = (label?: string | null) =>
  (label ?? "").trim().toLowerCase().endsWith("estado general del panel");

const checklistOptions = (label?: string | null) =>
  isEstadoFosoLabel(label)
    ? [
        { value: "approved", text: "Aprobado" },
        { value: "failed", text: "Requiere limpieza" },
        { value: "na", text: "N/A" },
      ]
    : isEstadoGeneralPanelLabel(label)
      ? [
          { value: "approved", text: "Bueno" },
          { value: "na", text: "Regular" },
          { value: "failed", text: "Malo" },
        ]
      : [
          { value: "approved", text: "Aprobado" },
          { value: "failed", text: "Falla" },
          { value: "na", text: "N/A" },
        ];

// Nombres bonitos de los encabezados de sección del checklist. La clave es el prefijo
// interno del label (el grupo); el valor es lo que ve el técnico. Los paneles de control se
// muestran por sistema (feedback William 14-jul) sin tener que renombrar labels en la base.
const GROUP_DISPLAY: Record<string, string> = {
  Tablero: "Panel de Control - Bombas Principales",
  "Tablero reforzador": "Panel de Control - Sistema Reforzador",
  "Panel contra incendios": "Panel de la Bomba Principal Contra Incendios",
  "Panel jockey": "Panel de la Bomba Jockey",
};
const groupDisplayName = (name: string) => GROUP_DISPLAY[name] ?? name;


async function handleResponses(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const visitId = String(formData.get("visit_id") ?? "");
  const action = String(formData.get("action") ?? "save");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!visitId) {
    redirect("/tech/today");
  }

  const { data: visit } = await supabase
    .from("visits")
    .select("id,template_id,assigned_tech_user_id,assigned_crew_id,status,building_id")
    .eq("id", visitId)
    .maybeSingle();

  // Acceso por CUADRILLA: el técnico asignado O cualquiera de la cuadrilla
  // asignada puede guardar/completar (aunque otro haya reclamado la visita).
  const canAccessVisit =
    visit?.assigned_tech_user_id === user.id ||
    (Boolean(visit?.assigned_crew_id) &&
      visit?.assigned_crew_id ===
        (
          await supabase
            .from("profiles")
            .select("home_crew_id")
            .eq("user_id", user.id)
            .maybeSingle()
        ).data?.home_crew_id);

  if (!visit || !canAccessVisit) {
    redirect("/unauthorized");
  }

  const { data: templateMeta } = visit.template_id
    ? await supabase
        .from("visit_templates")
        .select("name,category")
        .eq("id", visit.template_id)
        .maybeSingle()
    : { data: null as { name?: string | null; category?: string | null } | null };

  const isChecklistTemplate =
    isCoreChecklistTemplateId(visit.template_id) ||
    isBombasTemplate(templateMeta?.name, templateMeta?.category) ||
    isEscalerasTemplate(templateMeta?.name);

  const { data: templateItemsData } = visit.template_id
    ? await supabase
        .from("template_items")
        .select("id,label,item_type,required,sort_order")
        .eq("template_id", visit.template_id)
        .order("sort_order", { ascending: true })
    : { data: [] as TemplateItem[] };

  // Alcance del edificio (precarga): sistemas presentes + nº de bombas por sistema. Se usa
  // para descartar los ítems de secciones/unidades que no aplican: no se validan ni se
  // guardan, así el técnico no queda trancado por secciones ocultas y el PDF (que se arma
  // de las respuestas) las omite solo. Fallback: sin equipos precargados → no se filtra.
  let buildingScope: BuildingScope = EMPTY_SCOPE;
  if (visit.building_id) {
    const { data: buildingEquipmentRows } = await supabase
      .from("equipment")
      .select("name,system,kind")
      .eq("building_id", visit.building_id)
      .eq("is_active", true);
    buildingScope = buildBuildingScope(buildingEquipmentRows ?? []);
  }
  const applyBuildingFilter =
    isBombasTemplate(templateMeta?.name, templateMeta?.category) &&
    buildingScope.systems.size > 0;
  const scopedItems = applyBuildingFilter
    ? (templateItemsData ?? []).filter((item) =>
        itemAppliesToBuilding(String(item.label ?? ""), buildingScope)
      )
    : templateItemsData ?? [];

  const errors: string[] = [];
  const responses = scopedItems.map((item) => {
      const fieldKey = `item-${item.id}`;
      const itemType = String(item.item_type ?? "");
      const required = Boolean(item.required);

      if (itemType === "checkbox") {
        const rawValue = formData.get(fieldKey);
        let valueBool: boolean | null = null;

        if (rawValue === "on") {
          // Legacy checkbox (templates no core / demo).
          valueBool = true;
        } else if (rawValue === "approved") {
          valueBool = true;
        } else if (rawValue === "failed") {
          valueBool = false;
        } else {
          // "na" y cualquier otro → null
          valueBool = null;
        }

        if (action === "complete") {
          if (isChecklistTemplate) {
            // En los formularios core, TODOS los ítems tipo checklist
            // deben estar marcados como Aprobado, Falla o N/A.
            if (valueBool === null && rawValue !== "na") {
              errors.push(item.id);
            }
          } else if (required && !valueBool) {
            errors.push(item.id);
          }
        }

        return {
          visit_id: visit.id,
          item_id: item.id,
          value_text: rawValue === "na" ? "na" : null,
          value_number: null,
          value_bool: valueBool,
          created_by: user.id,
        };
      }

      if (itemType === "number") {
        const raw = String(formData.get(fieldKey) ?? "").trim();
        const valueNumber =
          raw === "" || raw === "null" ? null : Number(raw);
        const normalizedNumber = Number.isNaN(valueNumber) ? null : valueNumber;
        if (action === "complete" && required && normalizedNumber === null) {
          errors.push(item.id);
        }
        return {
          visit_id: visit.id,
          item_id: item.id,
          value_text: null,
          value_number: normalizedNumber,
          value_bool: null,
          created_by: user.id,
        };
      }

      const rawText = String(formData.get(fieldKey) ?? "").trim();
      if (action === "complete" && required && rawText.length === 0) {
        errors.push(item.id);
      }
      return {
        visit_id: visit.id,
        item_id: item.id,
        value_text: rawText,
        value_number: null,
        value_bool: null,
        created_by: user.id,
      };
    });

  if (action === "complete" && errors.length > 0) {
    // Mensaje preciso: distingue si lo que falta son checkbox o campos de texto/número.
    const errorItems = (templateItemsData ?? []).filter((i) => errors.includes(i.id));
    const onlyCheckbox = errorItems.every((i) => i.item_type === "checkbox");
    const message = !isChecklistTemplate
      ? "Completa los campos requeridos."
      : onlyCheckbox
        ? "Debes marcar todos los ítems como Aprobado, Falla o N/A."
        : "Faltan campos requeridos por completar (revisa los marcados con *).";
    redirect(
      `/tech/visits/${visitId}?error=${encodeURIComponent(message)}`
    );
  }

  if (action === "save" || action === "complete") {
    // Mismo token determinístico que el autosave: "Guardar"/"Completar" caen en la
    // misma fila por campo (upsert), sin duplicar respuestas ya guardadas.
    const tokenedResponses = responses.map((r) => ({
      ...r,
      client_token: `${r.visit_id}:${r.item_id}`,
    }));
    const { error: insertError } = await supabase
      .from("visit_responses")
      .upsert(tokenedResponses, { onConflict: "client_token" });

    if (insertError) {
      console.error(insertError);
      redirect(
        `/tech/visits/${visitId}?error=${encodeURIComponent(
          `No se pudieron guardar las respuestas: ${insertError.message}`
        )}`
      );
    }
  }

  if (action === "save") {
    const { error: notesError } = await supabase
      .from("visits")
      .update({ notes: notes || null })
      .eq("id", visitId);

    if (notesError) {
      console.error(notesError);
      redirect(
        `/tech/visits/${visitId}?error=${encodeURIComponent(
          notesError.message
        )}`
      );
    }
  }

  if (action === "complete") {
    const { error: completeError } = await supabase
      .from("visits")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        notes: notes || null,
      })
      .eq("id", visitId);

    if (completeError) {
      console.error(completeError);
      redirect(
        `/tech/visits/${visitId}?error=${encodeURIComponent(
          completeError.message
        )}`
      );
    }
  }

  if (action === "complete") {
    redirect(`/tech/today?completed=1`);
  }

  redirect(`/tech/visits/${visitId}?saved=1`);
}

// Firma de recibido (estándar de los formularios SEMCO: "Recibido por / Realizado por").
// El cliente firma en el celular del técnico; se guarda como media kind="signature".
async function handleSignatureUpload(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const visitId = String(formData.get("visit_id") ?? "");
  if (!visitId) {
    redirect("/tech/today");
  }

  const dataUrl = String(formData.get("signature_data") ?? "");
  const signerName = String(formData.get("signature_name") ?? "").trim();
  // Rol de quien firma → media.signer_role. Estampa cada firma en su línea del
  // PDF ("Técnico responsable" vs "Recibido por el cliente"). NO va en
  // media.system: ese campo es el sistema de la evidencia.
  const signerRole: SignerRole =
    String(formData.get("signer_role") ?? "cliente").trim() === "tecnico"
      ? "tecnico"
      : "cliente";
  const b64 = dataUrl.startsWith("data:image/png;base64,")
    ? dataUrl.slice("data:image/png;base64,".length)
    : "";
  if (!b64) {
    redirect(
      `/tech/visits/${visitId}?media_error=${encodeURIComponent(
        "Dibuja la firma antes de guardarla."
      )}`
    );
  }

  const { data: visit } = await supabase
    .from("visits")
    .select("id,building_id,assigned_tech_user_id,assigned_crew_id,status")
    .eq("id", visitId)
    .maybeSingle();

  if (!visit || !visit.building_id) {
    redirect(
      `/tech/visits/${visitId}?media_error=${encodeURIComponent(
        "No se encontró la visita."
      )}`
    );
  }

  const canAccessVisit =
    visit.assigned_tech_user_id === user.id ||
    (Boolean(visit.assigned_crew_id) &&
      visit.assigned_crew_id ===
        (
          await supabase
            .from("profiles")
            .select("home_crew_id")
            .eq("user_id", user.id)
            .maybeSingle()
        ).data?.home_crew_id);

  if (!canAccessVisit) {
    redirect("/unauthorized");
  }

  const bytes = Buffer.from(b64, "base64");
  const nameSlug = signerName
    ? signerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)
    : "recibido";
  const file = new File([new Uint8Array(bytes)], `firma-${nameSlug}.png`, {
    type: "image/png",
  });

  // Una firma por rol y por visita: la nueva REEMPLAZA a la anterior.
  // Antes se acumulaban (30 duplicados en prod al 10-jul) porque el pad no daba
  // señal de guardado y el técnico volvía a firmar.
  const { data: previas } = await supabase
    .from("media")
    .select("id,storage_path")
    .eq("visit_id", visit.id)
    .eq("kind", "signature")
    .eq("signer_role", signerRole);

  const { error } = await uploadMedia({
    buildingId: visit.building_id,
    visitId: visit.id,
    file,
    kind: "signature",
    signerRole,
  });

  if (error) {
    redirect(
      `/tech/visits/${visitId}?media_error=${encodeURIComponent(error)}`
    );
  }

  // Se borran DESPUÉS de que la nueva quedó guardada: si el borrado falla, hay
  // una firma de más (recuperable), no ninguna.
  if (previas?.length) {
    await supabase
      .from("media")
      .delete()
      .in("id", previas.map((p) => p.id));
    await supabase.storage
      .from(MEDIA_BUCKET)
      .remove(previas.map((p) => p.storage_path));
  }

  redirect(`/tech/visits/${visitId}?signature_saved=1`);
}

async function handleMediaDelete(formData: FormData) {
  "use server";

  await requireRole(["tech"]);

  const supabase = await createClient();

  const visitId = String(formData.get("visit_id") ?? "");
  const mediaId = String(formData.get("media_id") ?? "");
  if (!visitId || !mediaId) {
    redirect("/tech/today");
  }

  const { data: mediaRow, error: mediaReadError } = await supabase
    .from("media")
    .select("id,visit_id,storage_path,created_by")
    .eq("id", mediaId)
    .eq("visit_id", visitId)
    .maybeSingle();

  if (mediaReadError || !mediaRow) {
    redirect(
      `/tech/visits/${visitId}?media_error=${encodeURIComponent(
        "No se encontró la evidencia."
      )}`
    );
  }

  // La fila primero: RLS solo deja al tech borrar su propia foto. Si el objeto
  // se borrara antes, la foto de un compañero se perdería del bucket aunque el
  // DELETE de la fila resultara negado.
  const { data: deleted, error: dbDeleteError } = await supabase
    .from("media")
    .delete()
    .eq("id", mediaId)
    .select("id");

  if (dbDeleteError) {
    redirect(
      `/tech/visits/${visitId}?media_error=${encodeURIComponent(
        dbDeleteError.message
      )}`
    );
  }

  // Cero filas = RLS negó el borrado (la foto la subió otro tech), sin error.
  if (!deleted?.length) {
    redirect(
      `/tech/visits/${visitId}?media_error=${encodeURIComponent(
        "Solo puedes borrar las fotos que tú subiste."
      )}`
    );
  }

  const { error: storageDeleteError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .remove([mediaRow.storage_path]);

  if (storageDeleteError) {
    redirect(
      `/tech/visits/${visitId}?media_error=${encodeURIComponent(
        storageDeleteError.message
      )}`
    );
  }

  redirect(`/tech/visits/${visitId}?media_saved=1`);
}

export default async function TechVisitPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select(
      "id,status,scheduled_for,started_at,completed_at,assigned_tech_user_id,assigned_crew_id,building_id,template_id,notes"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (visitError) {
    return (
      <div className="min-h-screen p-8">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando visita: {visitError.message}
        </div>
      </div>
    );
  }

  const canAccessVisit =
    visit?.assigned_tech_user_id === user.id ||
    (Boolean(visit?.assigned_crew_id) &&
      visit?.assigned_crew_id === user.home_crew_id);

  if (!visit || !canAccessVisit) {
    redirect("/unauthorized");
  }

  const { data: templateItemsData } = visit.template_id
    ? await supabase
        .from("template_items")
        .select("id,label,item_type,required,sort_order")
        .eq("template_id", visit.template_id)
        .order("sort_order", { ascending: true })
    : { data: [] as TemplateItem[] };

  const { data: responses } = await supabase
    .from("visit_latest_responses")
    .select("item_id,value_text,value_number,value_bool")
    .eq("visit_id", visit.id);

  const responseMap = new Map<string, VisitLatestResponse>();
  (responses ?? []).forEach((response) => {
    if (!response.item_id) return;
    responseMap.set(response.item_id, response);
  });

  const { data: templateMeta } = visit.template_id
    ? await supabase
        .from("visit_templates")
        .select("name,category")
        .eq("id", visit.template_id)
        .maybeSingle()
    : { data: null as { name?: string | null; category?: string | null } | null };

  // Nombre real del edificio + equipos precargados (encabezado y sección "Equipos del edificio").
  const buildingRow = visit.building_id
    ? (
        await supabase
          .from("buildings")
          .select("name")
          .eq("id", visit.building_id)
          .maybeSingle()
      ).data
    : null;
  const buildingEquipment = visit.building_id
    ? (
        await supabase
          .from("equipment")
          .select("id,name,system,kind,manufacturer,model,specs")
          .eq("building_id", visit.building_id)
          .eq("is_active", true)
          .order("system", { ascending: true })
      ).data ?? []
    : [];

  // Fotos por equipo para que el TÉCNICO les eche un vistazo durante la inspección
  // (feedback William 1-jul). Solo lectura; el RLS nuevo deja al técnico leer media
  // de equipo. Firmamos los URLs con la sesión del técnico.
  const equipmentPhotos = new Map<
    string,
    Array<{ id: string; signed_url: string | null; label: string | null }>
  >();
  const equipmentIds = buildingEquipment.map((e) => e.id);
  if (equipmentIds.length > 0) {
    const { data: eqMedia } = await supabase
      .from("media")
      .select("id,equipment_id,storage_path,label,kind")
      .in("equipment_id", equipmentIds)
      .eq("kind", "evidence")
      .order("created_at", { ascending: false });
    await Promise.all(
      (eqMedia ?? []).map(async (m) => {
        if (!m.equipment_id) return;
        const { data: url } = await createSignedMediaUrl(m.storage_path);
        const arr = equipmentPhotos.get(m.equipment_id) ?? [];
        arr.push({ id: m.id, signed_url: url, label: m.label });
        equipmentPhotos.set(m.equipment_id, arr);
      })
    );
  }

  const isChecklistTemplate =
    isCoreChecklistTemplateId(visit.template_id) ||
    isBombasTemplate(templateMeta?.name, templateMeta?.category) ||
    isEscalerasTemplate(templateMeta?.name);
  const templateItems = templateItemsData ?? [];

  // Filtro dinámico por edificio (feedback William 1-jul / ONIX 5-jul): el checklist de
  // bombas refleja el inventario real — unidades por bomba precargada + subtipos presentes.
  // Debe coincidir con el filtro del server action `handleResponses`. Fallback: edificio sin
  // equipos precargados → se muestra todo (comportamiento previo, no rompe edificios sin levantamiento).
  const buildingScope = buildBuildingScope(buildingEquipment);
  const applyBuildingFilter =
    isBombasTemplate(templateMeta?.name, templateMeta?.category) &&
    buildingScope.systems.size > 0;
  const itemInScope = (item: (typeof templateItems)[number]) =>
    !applyBuildingFilter ||
    itemAppliesToBuilding(String(item.label ?? ""), buildingScope);

  const requiredChecklistItemIds = isChecklistTemplate
    ? templateItems
        .filter((i) => i.item_type === "checkbox")
        .filter(itemInScope)
        .map((i) => i.id)
    : [];

  const normalizedStatus = String(visit.status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const isCompleted = normalizedStatus === "completed";
  const canShowForm =
    normalizedStatus === "in_progress" || normalizedStatus === "completed";
  const isSaved = searchParams?.saved === "1";
  const isMediaSaved = searchParams?.media_saved === "1";
  const isSignatureSaved = searchParams?.signature_saved === "1";
  const buildingName = buildingRow?.name ?? "Edificio";
  const templateName = templateMeta?.name ?? "Formulario";

  // Agrupa los campos del formulario por el prefijo del label (antes del primer " - ")
  // para mostrarlos en secciones desplegables — mejor experiencia en campo.
  const SYSTEM_LABELS: Record<string, string> = {
    transferencia_agua_potable: "Transferencia agua potable",
    reforzador_agua_potable: "Reforzador agua potable",
    contra_incendios: "Contra incendios (NFPA)",
    contra_incendios_no_normada: "Contra incendios (no normada)",
    achique_freatico: "Achique freático",
    achique_elevador: "Achique elevador",
    achique_pluvial: "Achique pluvial",
    sanitario: "Sanitario",
    planta_diesel: "Planta diésel",
  };
  const itemGroups: { name: string; items: typeof templateItems }[] = [];
  for (const item of templateItems) {
    if (!itemInScope(item)) continue;
    const g = groupOf(String(item.label ?? ""));
    let bucket = itemGroups.find((x) => x.name === g);
    if (!bucket) {
      bucket = { name: g, items: [] };
      itemGroups.push(bucket);
    }
    bucket.items.push(item);
  }

  // #2 (feedback William): la lista de equipos solo aplica al mantenimiento de bombas,
  // no a rociadores/incendio.
  const showEquipment = isBombasTemplate(templateMeta?.name, templateMeta?.category);
  // #3 (feedback William): agrupar los equipos precargados por sistema (como en el Excel).
  const equipmentBySystem: {
    system: string;
    label: string;
    items: typeof buildingEquipment;
  }[] = [];
  for (const eq of buildingEquipment) {
    const sys = eq.system ?? "otro";
    let g = equipmentBySystem.find((x) => x.system === sys);
    if (!g) {
      g = { system: sys, label: SYSTEM_LABELS[sys] ?? sys, items: [] };
      equipmentBySystem.push(g);
    }
    g.items.push(eq);
  }

  const { data: mediaRows } = await listMedia({ visitId: visit.id, limit: 50 });
  const allMediaWithUrls = await Promise.all(
    (mediaRows ?? []).map(async (row) => {
      const { data: signedUrl } = await createSignedMediaUrl(row.storage_path);
      return {
        ...row,
        signed_url: signedUrl,
      };
    })
  );
  // Las firmas de recibido se muestran aparte de la evidencia fotográfica.
  const mediaWithUrls = allMediaWithUrls.filter((m) => m.kind !== "signature");
  const signaturesWithUrls = allMediaWithUrls.filter((m) => m.kind === "signature");
  const signedRoles = Array.from(
    new Set(
      signaturesWithUrls
        .map((s) => s.signer_role)
        .filter((r): r is SignerRole => r === "cliente" || r === "tecnico")
    )
  );
  // Identidad de las firmas actuales. Al reemplazar una, cambia el id → cambia
  // la clave → el pad se remonta limpio.
  const signatureFormKey = signaturesWithUrls.map((s) => s.id).join("|") || "vacio";

  return (
    <div className="min-h-screen p-8">
      <VisitToast message={searchParams?.error} />
      <div className="-mx-8 -mt-8 mb-6 bg-slate-900 px-8 pb-5 pt-6 text-white">
        <Link href="/tech/today" className="text-sm text-slate-300 hover:text-white">
          ← Volver a hoy
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{buildingName}</h1>
        <p className="text-slate-300">{templateName}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
          <span>Programada: {visit.scheduled_for}</span>
          <span>Estado: {visit.status}</span>
        </div>
      </div>

      {searchParams?.saved ? (
        <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Guardado ✅
        </div>
      ) : null}

      {searchParams?.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </div>
      ) : null}
      {searchParams?.media_error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {decodeURIComponent(searchParams.media_error)}
        </div>
      ) : null}
      {isMediaSaved ? (
        <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Evidencia guardada ✅
        </div>
      ) : null}
      {isSignatureSaved ? (
        <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Firma guardada ✅ — no hace falta firmar de nuevo.
        </div>
      ) : null}

      {showEquipment ? (
        buildingEquipment.length > 0 ? (
          <details className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white" open>
            <summary className="cursor-pointer list-none bg-slate-100 px-4 py-3 font-semibold text-slate-800">
              Equipos del edificio
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({buildingEquipment.length} precargados)
              </span>
            </summary>
            <div className="space-y-2 px-3 py-2">
              <a
                href={`/tech/buildings/${visit.building_id}/equipment?visit=${visit.id}`}
                className="mb-1 flex items-center justify-between rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-sm font-semibold text-cyan-800"
              >
                <span className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zm8 3a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" />
                  </svg>
                  Ver inventario de fotos por equipo
                </span>
                <span className="text-cyan-400">›</span>
              </a>
              {equipmentBySystem.map((grp) => (
                <details
                  key={grp.system}
                  className="overflow-hidden rounded border border-slate-100"
                >
                  <summary className="cursor-pointer list-none bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    {grp.label}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      ({grp.items.length})
                    </span>
                  </summary>
                  <div className="divide-y divide-slate-100 px-3">
                    {grp.items.map((eq) => {
                      const photos = equipmentPhotos.get(eq.id) ?? [];
                      return (
                        <div key={eq.id} className="py-1.5 text-sm">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-medium text-slate-800">{eq.name}</span>
                            <span className="text-xs text-slate-500">
                              {[eq.manufacturer, eq.model].filter(Boolean).join(" · ")}
                            </span>
                          </div>
                          {photos.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {photos.map((p) =>
                                p.signed_url ? (
                                  <a
                                    key={p.id}
                                    href={p.signed_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block"
                                    title={p.label ?? undefined}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={p.signed_url}
                                      alt={p.label ?? "Foto del equipo"}
                                      className="h-16 w-16 rounded border border-slate-200 object-cover"
                                    />
                                  </a>
                                ) : null
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ) : (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              Este edificio aún no tiene equipos mapeados.
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Mapéalos una vez y quedan precargados para todas las visitas.
            </p>
            <a
              href={`/tech/buildings/${visit.building_id}/equipment/new?visit=${visit.id}`}
              className="mt-3 inline-block rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              + Mapear equipos del edificio
            </a>
          </div>
        )
      ) : null}

      {normalizedStatus === "planned" ? (
        <StartVisitButton visitId={visit.id} />
      ) : null}

      {canShowForm ? (
        <>
          <form id="visit-form" action={handleResponses} className="space-y-4 max-w-2xl">
            <input type="hidden" name="visit_id" value={visit.id} />
            <AutosaveManager
              visitId={visit.id}
              formId="visit-form"
              enabled={!isCompleted}
            />
            {templateItems.length === 0 ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                No se pudieron cargar items del formulario (RLS o formulario vacío).
                <div className="mt-1 text-xs text-amber-700">
                  template_id: {visit.template_id} · visit_id: {visit.id}
                </div>
              </div>
            ) : null}
            {itemGroups.map((group, gi) => (
              <details
                key={group.name}
                open={gi === 0}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <summary className="cursor-pointer list-none bg-slate-800 px-4 py-3 font-semibold text-white">
                  {groupDisplayName(group.name)}
                  <span className="ml-2 text-sm font-normal text-slate-300">
                    ({group.items.length})
                  </span>
                </summary>
                <div className="space-y-3 p-3">
                  {group.items.map((item) => {
              const response = responseMap.get(item.id);
              const itemType = String(item.item_type ?? "");
              const fieldName = `item-${item.id}`;
              const _sep = String(item.label ?? "").indexOf(" - ");
              const cleanLabel = _sep > 0 ? String(item.label).slice(_sep + 3) : item.label;
              const opts = checklistOptions(item.label);

              return (
                <div
                  key={item.id}
                  id={`item-row-${item.id}`}
                  data-item-row
                  className="rounded border border-slate-200 p-4"
                >
                <label className="mb-2 block text-sm font-medium">
                  {cleanLabel}
                  {item.required ? " *" : ""}
                </label>
                {itemType === "checkbox" ? (
                  isChecklistTemplate ? (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">
                        Selecciona una opción por ítem:{" "}
                        {opts.map((opt, oi) => (
                          <span key={opt.value}>
                            {oi === 0
                              ? ""
                              : oi === opts.length - 1
                              ? " o "
                              : ", "}
                            <span className="font-semibold">{opt.text}</span>
                          </span>
                        ))}
                        .
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {opts.map((opt, oi) => (
                          <label
                            key={opt.value}
                            className="inline-flex items-center gap-2 text-sm"
                          >
                            <input
                              id={oi === 0 ? fieldName : undefined}
                              type="radio"
                              name={fieldName}
                              value={opt.value}
                              defaultChecked={
                                opt.value === "approved"
                                  ? response?.value_bool === true
                                  : opt.value === "failed"
                                  ? response?.value_bool === false
                                  : response?.value_bool === null &&
                                    response?.value_text === "na"
                              }
                              disabled={isCompleted}
                            />
                            <span>{opt.text}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">
                        ✅ Sí = OK · ❌ No = Falla · N/A: escríbelo en Observaciones
                      </p>
                      <input
                        type="checkbox"
                        name={fieldName}
                        defaultChecked={response?.value_bool ?? false}
                        disabled={isCompleted}
                      />
                    </div>
                  )
                ) : null}
                {itemType === "number" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      // Voltajes, amperajes y presiones se miden con decimales (208.5 V,
                      // 12.3 A). Sin step="any" el navegador rechaza la coma decimal.
                      step="any"
                      inputMode="decimal"
                      name={fieldName}
                      defaultValue={
                        response?.value_number !== null &&
                        response?.value_number !== undefined
                          ? response.value_number
                          : ""
                      }
                      disabled={isCompleted}
                      className="w-full rounded border px-3 py-2"
                    />
                  </div>
                ) : null}
                {itemType === "text" ? (
                  <input
                    type="text"
                    name={fieldName}
                    defaultValue={response?.value_text ?? ""}
                    disabled={isCompleted}
                    className="w-full rounded border px-3 py-2"
                  />
                ) : null}
                {itemType === "textarea" ? (
                  isRecorridoPorPisosLabel(item.label) ? (
                    <RecorridoTable
                      itemId={item.id}
                      defaultValue={response?.value_text ?? ""}
                      disabled={isCompleted}
                      visitId={visit.id}
                    />
                  ) : (
                    <textarea
                      name={fieldName}
                      rows={3}
                      defaultValue={response?.value_text ?? ""}
                      disabled={isCompleted}
                      className="w-full rounded border px-3 py-2"
                    />
                  )
                ) : null}
                {itemType !== "textarea" &&
                  isRecorridoPorPisosLabel(item.label) ? (
                  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    Error de configuración: este campo debe ser tipo
                    &quot;textarea&quot; para mostrar la tabla de recorrido.
                    Contacte al administrador.
                  </div>
                ) : null}
                </div>
              );
            })}
                </div>
              </details>
            ))}

            <div className="rounded border p-4">
              <label className="mb-2 block text-sm font-medium">
                Observaciones del técnico (interno)
              </label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={visit.notes ?? ""}
                disabled={isCompleted}
                placeholder="Observaciones relevantes para el gerente (no se envían al cliente)"
                className="w-full rounded border px-3 py-2"
              />
            </div>

            {isCompleted ? (
              <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                Esta visita ya fue completada.
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  type="submit"
                  name="action"
                  value="save"
                  className="rounded border px-4 py-2 text-gray-700"
                >
                  Guardar
                </button>
                <CompleteVisitButton
                  enforceChecklistValidation={isChecklistTemplate}
                  requiredChecklistItemIds={requiredChecklistItemIds}
                  isCompleted={isCompleted}
                />
              </div>
            )}
          </form>

          <div className="mt-4 max-w-2xl rounded border p-4">
            <OfflinePhotoCapture visitId={visit.id} disabled={isCompleted} />

            <div className="mt-4">
              <p className="text-sm font-medium text-gray-800">Evidencia subida</p>
              {mediaWithUrls.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">Sin evidencia todavía.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {mediaWithUrls.map((media) => (
                    <li
                      key={media.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{media.storage_path.split("/").pop()}</p>
                        <p className="text-xs text-gray-500">
                          {media.system ? (
                            <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                              {SYSTEM_LABELS[media.system] ?? media.system}
                            </span>
                          ) : null}
                          {media.mime_type} · {(media.size_bytes / 1024 / 1024).toFixed(2)} MB
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
                            Ver
                          </a>
                        ) : null}
                        {!isCompleted ? (
                          <form action={handleMediaDelete}>
                            <input type="hidden" name="visit_id" value={visit.id} />
                            <input type="hidden" name="media_id" value={media.id} />
                            <button
                              type="submit"
                              className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-700"
                            >
                              Eliminar
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Firma de recibido — estándar SEMCO ("Recibido por") en todos los formularios */}
          <div className="mt-4 max-w-2xl rounded border p-4">
            {signaturesWithUrls.length > 0 ? (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-800">Firma de recibido ✓</p>
                <ul className="mt-2 space-y-2">
                  {signaturesWithUrls.map((sig) => (
                    <li key={sig.id} className="flex flex-wrap items-center gap-3 rounded border px-3 py-2">
                      {sig.signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sig.signed_url}
                          alt="Firma de recibido"
                          className="h-16 w-auto rounded border bg-white"
                        />
                      ) : null}
                      <span className="text-xs text-gray-500">
                        {sig.storage_path.split("/").pop()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {!isCompleted ? (
              <form action={handleSignatureUpload} className="space-y-3">
                <input type="hidden" name="visit_id" value={visit.id} />
                {/* El `key` cambia cuando cambian las firmas guardadas → el pad
                    se remonta y el lienzo queda limpio. Sin esto el trazo sigue
                    dibujado tras guardar y el técnico cree que no se guardó. */}
                <SignaturePad key={signatureFormKey} signedRoles={signedRoles} />
              </form>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
