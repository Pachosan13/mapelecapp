import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPanamaDateLabel } from "@/lib/dates/panama";
import { getCrewsWithDisplay } from "@/lib/crews/withMembers";
import { formatAssignmentLabel } from "@/lib/formatters/assignmentLabel";
import type { Database } from "@/lib/database.types";

const MAX_TEXT_LENGTH = 120;
const SNAPSHOT_GAP_MS = 3000;
const PANAMA_TIME_ZONE = "America/Panama";

type SearchParams = {
  all?: string;
};

type TemplateItem = Pick<
  Database["public"]["Tables"]["template_items"]["Row"],
  "id" | "label" | "item_type" | "sort_order"
>;
type VisitResponse = Pick<
  Database["public"]["Tables"]["visit_responses"]["Row"],
  "id" | "item_id" | "value_text" | "value_number" | "value_bool" | "created_at" | "created_by"
>;
type VisitWithRefs = Pick<
  Database["public"]["Tables"]["visits"]["Row"],
  | "id"
  | "building_id"
  | "template_id"
  | "scheduled_for"
  | "status"
  | "assigned_tech_user_id"
  | "assigned_crew_id"
> & {
  building: Pick<Database["public"]["Tables"]["buildings"]["Row"], "id" | "name"> | null;
  template:
    | Pick<Database["public"]["Tables"]["visit_templates"]["Row"], "id" | "name">
    | null;
};

type Snapshot = {
  created_at: string;
  created_by: string | null;
  responses: VisitResponse[];
};

const formatStatus = (status?: string | null) => {
  if (!status) return "Scheduled";
  return status.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
};

const formatPanamaDateTime = (value: string) => {
  return new Intl.DateTimeFormat("es-PA", {
    timeZone: PANAMA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
};

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
};

const formatResponseValue = (
  itemType: string,
  response: VisitResponse
): string => {
  if (itemType === "checkbox") {
    if (response.value_bool === null) {
      return "—";
    }
    return response.value_bool ? "✅" : "❌";
  }

  if (itemType === "number") {
    return response.value_number !== null ? response.value_number.toString() : "—";
  }

  const trimmed = (response.value_text ?? "").trim();
  if (!trimmed) {
    return "—";
  }
  return truncateText(trimmed, MAX_TEXT_LENGTH);
};

export default async function OpsVisitDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  const supabase = (await createClient()).schema("public");

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select(
      "id,building_id,template_id,scheduled_for,status,assigned_tech_user_id,assigned_crew_id,building:buildings(id,name),template:visit_templates(id,name)"
    )
    .eq("id", params.id)
    .maybeSingle<VisitWithRefs>();

  if (visitError || !visit) {
    return (
      <div className="min-h-screen p-8">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {visitError
            ? `Error cargando visita: ${visitError.message}`
            : "No se encontró la visita solicitada."}
        </div>
      </div>
    );
  }

  const { data: templateItems } =
    visit.template_id
      ? await supabase
          .from("template_items")
          .select("id,label,item_type,sort_order")
          .eq("template_id", visit.template_id)
          .order("sort_order", { ascending: true })
      : { data: [] };

  const { data: responses } = await supabase
    .from("visit_responses")
    .select(
      "id,item_id,value_text,value_number,value_bool,created_at,created_by"
    )
    .eq("visit_id", visit.id)
    .order("created_at", { ascending: true });

  const templateItemById = new Map(
    (templateItems ?? []).map((item: TemplateItem) => [item.id, item])
  );

  const profileIds = new Set<string>();
  if (visit.assigned_tech_user_id) {
    profileIds.add(visit.assigned_tech_user_id);
  }
  (responses ?? []).forEach((response: VisitResponse) => {
    if (response.created_by) {
      profileIds.add(response.created_by);
    }
  });

  const profileIdList = Array.from(profileIds);
  const [profilesResult, crewsResult, techsResult] = await Promise.all([
    profileIdList.length > 0
      ? supabase
          .from("profiles")
          .select("user_id,full_name,role")
          .in("user_id", profileIdList)
      : Promise.resolve({ data: [] }),
    supabase.from("crews").select("id,name").order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("user_id,full_name,home_crew_id,created_at")
      .eq("role", "tech")
      .eq("is_active", true),
  ]);

  const profiles = profilesResult.data ?? [];
  const crewsRaw = crewsResult.data ?? [];
  const techs = (techsResult.data ?? []) as Array<{
    user_id: string;
    full_name: string | null;
    home_crew_id: string | null;
    created_at?: string | null;
  }>;
  const crewsWithDisplay = getCrewsWithDisplay(crewsRaw, techs);
  const techById = new Map(
    profiles.map((p) => [p.user_id, { full_name: p.full_name }])
  );
  const crewDisplayById = new Map(
    crewsWithDisplay.map((c) => [c.id, { leader: c.leader, helper: c.helper }])
  );
  const assignmentLabel = formatAssignmentLabel(
    visit,
    techById,
    crewDisplayById
  );
  const hasRealLeader = Boolean(visit.assigned_tech_user_id);
  const assignmentSectionLabel = hasRealLeader ? "Líder" : "Asignado";

  const profileNameById = new Map(
    profiles.map((profile) => [
      profile.user_id,
      profile.full_name?.trim() || "",
    ])
  );

  const getUserName = (userId: string | null) => {
    if (!userId) {
      return "Usuario desconocido";
    }
    const name = profileNameById.get(userId);
    if (name) {
      return name;
    }
    return `Usuario ${userId.slice(0, 6)}`;
  };

  const snapshots: Snapshot[] = [];
  let lastTimestampMs: number | null = null;

  (responses ?? []).forEach((response: VisitResponse) => {
    if (!response.created_at) return;
    const timestampMs = new Date(response.created_at).getTime();
    const shouldStartNew =
      lastTimestampMs === null || timestampMs - lastTimestampMs > SNAPSHOT_GAP_MS;

    if (shouldStartNew) {
      snapshots.push({
        created_at: response.created_at,
        created_by: response.created_by ?? null,
        responses: [response],
      });
    } else {
      snapshots[snapshots.length - 1].responses.push(response);
    }

    lastTimestampMs = timestampMs;
  });

  const buildSnapshotItems = (snapshot: Snapshot) => {
    return snapshot.responses
      .map((response) => {
        const item = response.item_id
          ? templateItemById.get(response.item_id)
          : undefined;
        const itemType = item?.item_type ?? "text";
        return {
          id: response.id,
          item_id: response.item_id,
          label: item?.label ?? `Item ${response.item_id?.slice(0, 6) ?? "—"}`,
          sort_order: item?.sort_order ?? 0,
          value: formatResponseValue(itemType, response),
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  };

  const showAll = searchParams?.all === "1";
  const snapshotsToShow = showAll ? snapshots : snapshots.slice(-10);
  const latestSnapshot = snapshots[snapshots.length - 1];
  const latestSnapshotLabel = latestSnapshot
    ? formatPanamaDateTime(latestSnapshot.created_at)
    : null;

  const buildingName = visit.building?.name
    ? visit.building.name
    : visit.building_id
      ? `Building ${visit.building_id.slice(0, 8)}`
      : "Building";
  const templateName = visit.template?.name
    ? visit.template.name
    : visit.template_id
      ? `Template ${visit.template_id.slice(0, 8)}`
      : "Formulario";
  const buildingHref = visit.building_id
    ? `/ops/buildings/${visit.building_id}`
    : "/ops/buildings";
  const canGenerateReport = visit.status === "completed" && Boolean(visit.building_id);

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href={buildingHref} className="text-sm text-gray-500">
          ← Volver al building
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Visita</h1>
        <p className="text-gray-600">
          {buildingName} · {templateName}
        </p>
        {canGenerateReport ? (
          <Link
            href={`/api/reports/service-report?buildingId=${visit.building_id}&reportDate=${visit.scheduled_for}`}
            className="mt-3 inline-flex rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Generar reporte (PDF)
          </Link>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 rounded border p-4 text-sm text-gray-700 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-gray-500">Scheduled for</p>
          <p className="text-sm font-medium">
            {formatPanamaDateLabel(visit.scheduled_for)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Status</p>
          <p className="text-sm font-medium">{formatStatus(visit.status)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">
            {assignmentSectionLabel}
          </p>
          <p className="text-sm font-medium">{assignmentLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Formulario</p>
          <p className="text-sm font-medium">{templateName}</p>
        </div>
      </div>

      <div className="mb-6 rounded border p-4">
        <div className="mb-2 text-sm font-semibold text-gray-700">
          Observaciones del técnico
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">
          —
        </p>
      </div>

      <div className="mb-8 rounded border p-4">
        <div className="mb-2 text-sm font-semibold text-gray-700">Último estado</div>
        {latestSnapshot ? (
          <ul className="space-y-1 text-sm text-gray-700">
            {buildSnapshotItems(latestSnapshot).map((item) => (
              <li key={item.id} className="flex flex-wrap gap-2">
                <span className="min-w-[180px] text-gray-600">{item.label}</span>
                <span>{item.value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Sin historial aún.</p>
        )}
      </div>

      <div className="mb-4 space-y-2">
        <div className="text-xs text-gray-500">
          <span>Snapshots: {snapshots.length}</span>
          <span className="mx-2 text-gray-300">·</span>
          <span>
            Última actualización: {latestSnapshotLabel ?? "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Historial</h2>
          <div className="flex items-center gap-4 text-sm">
            {snapshotsToShow.length > 0 ? (
              <Link
                href={`#snapshot-${snapshotsToShow.length - 1}`}
                className="text-blue-600 hover:underline"
              >
                Ir al más reciente
              </Link>
            ) : null}
            {snapshots.length > 10 ? (
              <Link
                href={
                  showAll
                    ? `/ops/visits/${visit.id}`
                    : `/ops/visits/${visit.id}?all=1`
                }
                className="text-blue-600 hover:underline"
              >
                {showAll ? "Ver menos" : "Ver todo"}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <p className="text-sm text-gray-500">Sin historial aún.</p>
      ) : (
        <div className="space-y-4">
          {snapshotsToShow.map((snapshot, index) => {
            const items = buildSnapshotItems(snapshot);
            return (
              <div
                key={`${snapshot.created_at}-${index}`}
                id={`snapshot-${index}`}
                className="rounded border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <span>{formatPanamaDateTime(snapshot.created_at)}</span>
                  <span>{getUserName(snapshot.created_by)}</span>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  {items.map((item) => (
                    <li key={item.id} className="flex flex-wrap gap-2">
                      <span className="min-w-[180px] text-gray-600">
                        {item.label}
                      </span>
                      <span>{item.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
