import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { isCoreChecklistTemplateId } from "@/lib/constants/coreChecklist";
import StartVisitButton from "./StartVisitButton";
import VisitToast from "./VisitToast";
import RecorridoTable from "./RecorridoTable";
import CompleteVisitButton from "./CompleteVisitButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  error?: string;
  saved?: string;
};

const isRecorridoPorPisosLabel = (label?: string | null) =>
  (label ?? "").trim().toLowerCase().startsWith("recorrido por pisos");

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

  if (!visitId) {
    redirect("/tech/today");
  }

  const { data: visit } = await supabase
    .from("visits")
    .select("id,template_id,assigned_tech_user_id,status,tech_observations")
    .eq("id", visitId)
    .maybeSingle();

  if (!visit || visit.assigned_tech_user_id !== user.id) {
    redirect("/unauthorized");
  }

  const isCoreTemplate = isCoreChecklistTemplateId(visit.template_id);

  const { data: items } = await supabase
    .from("template_items")
    .select("id,label,item_type,required,sort_order")
    .eq("template_id", visit.template_id)
    .order("sort_order", { ascending: true });

  const techObs = String(formData.get("tech_observations") ?? "").trim();

  const errors: string[] = [];
  const savedOnce = formData.get("saved_once") === "1";
  const responses =
    (items ?? []).map((item) => {
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
          valueBool = null;
        }

        if (action === "complete") {
          if (isCoreTemplate) {
            // En los formularios core, TODOS los ítems tipo checklist
            // deben estar marcados como Aprobado o Falla (no se permite null).
            if (valueBool === null) {
              errors.push(item.id);
            }
          } else if (required && !valueBool) {
            // Comportamiento legado para otros formularios:
            // solo se acepta "checked" como válido para campos requeridos.
            errors.push(item.id);
          }
        }

        return {
          visit_id: visit.id,
          item_id: item.id,
          value_text: null,
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
    }) ?? [];

  if (action === "complete" && errors.length > 0) {
    const message = isCoreTemplate
      ? "Debes marcar todos los ítems como Aprobado o Falla"
      : "Completa los campos requeridos.";
    redirect(
      `/tech/visits/${visitId}?error=${encodeURIComponent(message)}`
    );
  }

  if (action === "save" || (action === "complete" && !savedOnce)) {
    const { error: insertError } = await supabase
      .from("visit_responses")
      .insert(responses);

    if (insertError) {
      console.error(insertError);
      redirect(
        `/tech/visits/${visitId}?error=${encodeURIComponent(
          insertError.message
        )}`
      );
    }
  }

  const techObservationsUpdate = { tech_observations: techObs || null };
  if (action === "save") {
    const { error: updateErr } = await supabase
      .from("visits")
      .update(techObservationsUpdate)
      .eq("id", visitId);
    if (updateErr) {
      console.error(updateErr);
      redirect(
        `/tech/visits/${visitId}?error=${encodeURIComponent(updateErr.message)}`
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
        ...techObservationsUpdate,
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
      "id,status,scheduled_for,started_at,completed_at,assigned_tech_user_id,assigned_crew_id,template_id,tech_observations,building:buildings(id,name),template:visit_templates(id,name)"
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
    (visit?.assigned_tech_user_id === null &&
      visit?.assigned_crew_id &&
      visit?.assigned_crew_id === user.home_crew_id);

  if (!visit || !canAccessVisit) {
    redirect("/unauthorized");
  }

  const { data: items } = await supabase
    .from("template_items")
    .select("id,label,item_type,required,sort_order")
    .eq("template_id", visit.template_id)
    .order("sort_order", { ascending: true });

  const { data: responses } = await supabase
    .from("visit_latest_responses")
    .select("item_id,value_text,value_number,value_bool")
    .eq("visit_id", visit.id);

  const responseMap = new Map(
    (responses ?? []).map((response) => [response.item_id, response])
  );

  const isCoreTemplate = isCoreChecklistTemplateId(visit.template_id);
  const templateItems = items ?? [];
  const requiredChecklistItemIds = isCoreTemplate
    ? templateItems
        .filter((i) => i.item_type === "checkbox")
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

  return (
    <div className="min-h-screen p-8">
      <VisitToast message={searchParams?.error} />
      <div className="mb-6">
        <Link href="/tech/today" className="text-sm text-gray-500">
          ← Volver a hoy
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Visita</h1>
        <p className="text-gray-600">
          {visit.building?.name ?? "Building"} · {visit.template?.name ?? "Formulario"}
        </p>
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

      <div className="mb-6 rounded border p-4 text-sm text-gray-700">
        <div>Scheduled for: {visit.scheduled_for}</div>
        <div>Status: {visit.status}</div>
      </div>

      {normalizedStatus === "planned" ? (
        <StartVisitButton visitId={visit.id} />
      ) : null}

      {canShowForm ? (
        <form action={handleResponses} className="space-y-4 max-w-2xl">
          <input type="hidden" name="visit_id" value={visit.id} />
          <input type="hidden" name="saved_once" value={isSaved ? "1" : "0"} />
        {templateItems.length === 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No se pudieron cargar items del formulario (RLS o formulario vacío).
            <div className="mt-1 text-xs text-amber-700">
              template_id: {visit.template_id} · visit_id: {visit.id}
            </div>
          </div>
        ) : null}
          {templateItems.map((item) => {
            const response = responseMap.get(item.id);
            const itemType = String(item.item_type ?? "");
            const fieldName = `item-${item.id}`;

            return (
              <div key={item.id} className="rounded border p-4">
                <label className="mb-2 block text-sm font-medium">
                  {item.label}
                  {item.required ? " *" : ""}
                </label>
                {itemType === "checkbox" ? (
                  isCoreTemplate ? (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">
                        Selecciona una opción por ítem:{" "}
                        <span className="font-semibold">Aprobado</span> o{" "}
                        <span className="font-semibold">Falla</span>.
                      </p>
                      <div className="flex flex-wrap gap-4">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            id={fieldName}
                            type="radio"
                            name={fieldName}
                            value="approved"
                            defaultChecked={response?.value_bool === true}
                            disabled={isCompleted}
                          />
                          <span>Aprobado</span>
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={fieldName}
                            value="failed"
                            defaultChecked={response?.value_bool === false}
                            disabled={isCompleted}
                          />
                          <span>Falla</span>
                        </label>
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
              </div>
            );
          })}

          <div className="rounded border p-4">
            <label className="mb-2 block text-sm font-medium">
              Observaciones del técnico (interno)
            </label>
            <textarea
              name="tech_observations"
              rows={3}
              defaultValue={visit.tech_observations ?? ""}
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
                disabled={isSaved}
                className="rounded border px-4 py-2 text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Guardar
              </button>
              <CompleteVisitButton
                enforceChecklistValidation={isCoreTemplate}
                requiredChecklistItemIds={requiredChecklistItemIds}
                isCompleted={isCompleted}
              />
            </div>
          )}
        </form>
      ) : null}
    </div>
  );
}
