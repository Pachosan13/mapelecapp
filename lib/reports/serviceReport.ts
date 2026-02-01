import { createClient } from "@/lib/supabase/server";
import { getPanamaDayRange } from "@/lib/dates/panama";

type TemplateItem = {
  id: string;
  template_id: string | null;
  label: string;
  item_type: string;
  required: boolean | null;
  sort_order: number | null;
};

type VisitResponse = {
  visit_id: string | null;
  item_id: string | null;
  equipment_id: string | null;
  value_text: string | null;
  value_number: number | null;
  value_bool: boolean | null;
  created_at: string;
};

export type RecorridoPorPisosRow = {
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

const RECORRIDO_POR_PISOS_PREFIX = "recorrido por pisos";

export const isRecorridoPorPisosItem = (label?: string | null) =>
  (label ?? "").trim().toLowerCase().startsWith(RECORRIDO_POR_PISOS_PREFIX);

const normalizeRecorridoRow = (value: any): RecorridoPorPisosRow | null => {
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

export const parseRecorridoPorPisosValue = (
  value?: string | null
): RecorridoPorPisosRow[] | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((row) => normalizeRecorridoRow(row))
      .filter(Boolean) as RecorridoPorPisosRow[];
  } catch {
    return null;
  }
};

type ServiceReportRow = {
  id: string;
  building_id: string;
  report_date: string;
  status: string;
  client_summary: string | null;
  internal_notes: string | null;
  sent_at: string | null;
  sent_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type ServiceReportVisit = {
  id: string;
  template_id: string | null;
  completed_at: string | null;
  equipment_labels: string[];
  latest_response_by_item_id: Map<string, VisitResponse>;
};

type ServiceReportSection = {
  template_id: string;
  template_name: string;
  items: TemplateItem[];
  visits: ServiceReportVisit[];
};

type ServiceReportData = {
  building: { id: string; name: string };
  report_date: string;
  report: ServiceReportRow | null;
  sections: ServiceReportSection[];
  time_zone: string;
};

const PANAMA_TIME_ZONE = "America/Panama";

export const formatResponseValue = (
  itemType: string,
  response?: VisitResponse
): string => {
  if (!response) {
    return "—";
  }

  if (itemType === "checkbox") {
    if (response.value_bool === null) {
      return "—";
    }
    return response.value_bool ? "Sí" : "No";
  }

  if (itemType === "number") {
    return response.value_number !== null ? response.value_number.toString() : "—";
  }

  const trimmed = (response.value_text ?? "").trim();
  return trimmed || "—";
};

export async function getServiceReportData(params: {
  buildingId: string;
  reportDate: string;
  userId?: string | null;
}): Promise<{ data: ServiceReportData | null; error: string | null }> {
  const { buildingId, reportDate, userId } = params;
  const range = getPanamaDayRange(reportDate);
  if (!range) {
    return { data: null, error: "Fecha inválida." };
  }

  const supabase = await createClient();
  const reportSelect =
    "id,building_id,report_date,status,client_summary,internal_notes,sent_at,sent_by,created_at,updated_at,created_by,updated_by";

  const { data: building, error: buildingError } = await supabase
    .from("buildings")
    .select("id,name")
    .eq("id", buildingId)
    .maybeSingle();

  if (buildingError || !building) {
    return {
      data: null,
      error: buildingError?.message ?? "No se encontró el building.",
    };
  }

  const { data: existingReport, error: reportError } = await supabase
    .from("service_reports")
    .select(reportSelect)
    .eq("building_id", buildingId)
    .eq("report_date", reportDate)
    .maybeSingle();

  if (reportError) {
    return { data: null, error: reportError.message };
  }

  let report = existingReport as ServiceReportRow | null;

  if (!report) {
    const { data: insertedReport } = await supabase
      .from("service_reports")
      .insert({
        building_id: buildingId,
        report_date: reportDate,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
      .select(reportSelect)
      .maybeSingle();
    report = (insertedReport ?? null) as ServiceReportRow | null;
  }

  if (!report) {
    const { data: fallbackReport } = await supabase
      .from("service_reports")
      .select(reportSelect)
      .eq("building_id", buildingId)
      .eq("report_date", reportDate)
      .maybeSingle();
    report = (fallbackReport ?? null) as ServiceReportRow | null;
  }

  const { data: visitsData, error: visitsError } = await supabase
    .from("visits")
    .select("id,template_id,completed_at,template:visit_templates(id,name)")
    .eq("building_id", buildingId)
    .eq("status", "completed")
    .gte("completed_at", range.start)
    .lt("completed_at", range.end)
    .order("completed_at", { ascending: true });

  if (visitsError) {
    return { data: null, error: visitsError.message };
  }

  const visits =
    (visitsData as Array<{
      id: string;
      template_id: string | null;
      completed_at: string | null;
      template?: { id: string; name: string } | null;
    }>) ?? [];

  const templateIds = Array.from(
    new Set(visits.map((visit) => visit.template_id).filter(Boolean))
  ) as string[];

  const [templateItemsResult, responsesResult] = await Promise.all([
    templateIds.length > 0
      ? supabase
          .from("template_items")
          .select("id,template_id,label,item_type,required,sort_order")
          .in("template_id", templateIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    visits.length > 0
      ? supabase
          .from("visit_responses")
          .select(
            "visit_id,item_id,equipment_id,value_text,value_number,value_bool,created_at"
          )
          .in(
            "visit_id",
            visits.map((visit) => visit.id)
          )
      : Promise.resolve({ data: [] }),
  ]);

  const templateItems = (templateItemsResult.data ?? []) as TemplateItem[];
  const responses = (responsesResult.data ?? []) as VisitResponse[];

  const equipmentIds = Array.from(
    new Set(responses.map((response) => response.equipment_id).filter(Boolean))
  ) as string[];

  const { data: equipmentRows } =
    equipmentIds.length > 0
      ? await supabase
          .from("equipment")
          .select("id,name,tag,serial")
          .in("id", equipmentIds)
      : { data: [] };

  const equipmentLabelById = new Map(
    (equipmentRows ?? []).map((equipment) => {
      const label =
        equipment.name?.trim() ||
        equipment.tag?.trim() ||
        equipment.serial?.trim() ||
        `Equipo ${equipment.id.slice(0, 6)}`;
      return [equipment.id, label];
    })
  );

  const templateItemsByTemplateId = new Map<string, TemplateItem[]>();
  templateItems.forEach((item) => {
    if (!item.template_id) return;
    if (!templateItemsByTemplateId.has(item.template_id)) {
      templateItemsByTemplateId.set(item.template_id, []);
    }
    templateItemsByTemplateId.get(item.template_id)?.push(item);
  });

  const responsesByVisitId = new Map<string, VisitResponse[]>();
  responses.forEach((response) => {
    if (!response.visit_id) return;
    if (!responsesByVisitId.has(response.visit_id)) {
      responsesByVisitId.set(response.visit_id, []);
    }
    responsesByVisitId.get(response.visit_id)?.push(response);
  });

  const visitsByTemplateId = new Map<string, ServiceReportVisit[]>();
  const templateNameById = new Map<string, string>();

  visits.forEach((visit) => {
    if (!visit.template_id) {
      return;
    }

    if (visit.template?.id && visit.template?.name) {
      templateNameById.set(visit.template.id, visit.template.name);
    }

    const visitResponses = responsesByVisitId.get(visit.id) ?? [];
    const latestResponseByItemId = new Map<string, VisitResponse>();
    visitResponses.forEach((response) => {
      if (!response.item_id) return;
      const existing = latestResponseByItemId.get(response.item_id);
      if (!existing) {
        latestResponseByItemId.set(response.item_id, response);
        return;
      }
      if (new Date(response.created_at) > new Date(existing.created_at)) {
        latestResponseByItemId.set(response.item_id, response);
      }
    });

    const equipmentLabels = Array.from(
      new Set(
        visitResponses
          .map((response) => response.equipment_id)
          .filter(Boolean)
          .map((id) => equipmentLabelById.get(id!))
          .filter(Boolean)
      )
    ) as string[];

    if (!visitsByTemplateId.has(visit.template_id)) {
      visitsByTemplateId.set(visit.template_id, []);
    }

    visitsByTemplateId.get(visit.template_id)?.push({
      id: visit.id,
      template_id: visit.template_id,
      completed_at: visit.completed_at,
      equipment_labels: equipmentLabels,
      latest_response_by_item_id: latestResponseByItemId,
    });
  });

  const sections: ServiceReportSection[] = Array.from(
    visitsByTemplateId.entries()
  ).map(([templateId, templateVisits]) => {
    const templateName = templateNameById.get(templateId) ?? "Template";
    const items = templateItemsByTemplateId.get(templateId) ?? [];
    return {
      template_id: templateId,
      template_name: templateName,
      items,
      visits: templateVisits,
    };
  });

  sections.sort((a, b) => a.template_name.localeCompare(b.template_name));
  sections.forEach((section) => {
    section.visits.sort((a, b) => {
      const timeA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const timeB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return timeA - timeB;
    });
  });

  return {
    data: {
      building: {
        id: building.id,
        name: building.name ?? "Building",
      },
      report_date: reportDate,
      report,
      sections,
      time_zone: PANAMA_TIME_ZONE,
    },
    error: null,
  };
}
