import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import StartVisitButton from "./StartVisitButton";
import VisitToast from "./VisitToast";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  error?: string;
  saved?: string;
};

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
    .select("id,template_id,assigned_tech_user_id,status")
    .eq("id", visitId)
    .maybeSingle();

  if (!visit || visit.assigned_tech_user_id !== user.id) {
    redirect("/unauthorized");
  }

  const { data: items } = await supabase
    .from("template_items")
    .select("id,label,item_type,required,sort_order")
    .eq("template_id", visit.template_id)
    .order("sort_order", { ascending: true });

  const errors: string[] = [];
  const savedOnce = formData.get("saved_once") === "1";
  const responses =
    (items ?? []).map((item) => {
      const fieldKey = `item-${item.id}`;
      const itemType = String(item.item_type ?? "");
      const required = Boolean(item.required);

      if (itemType === "checkbox") {
        const checked = formData.get(fieldKey) === "on";
        if (action === "complete" && required && !checked) {
          errors.push(item.id);
        }
        return {
          visit_id: visit.id,
          item_id: item.id,
          value_text: null,
          value_number: null,
          value_bool: checked,
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
    redirect(
      `/tech/visits/${visitId}?error=${encodeURIComponent(
        "Completa los campos requeridos."
      )}`
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

  if (action === "complete") {
    const { error: completeError } = await supabase
      .from("visits")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: user.id,
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
      "id,status,scheduled_for,started_at,completed_at,assigned_tech_user_id,template_id,building:buildings(id,name),template:visit_templates(id,name)"
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

  if (!visit || visit.assigned_tech_user_id !== user.id) {
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
          {visit.building?.name ?? "Building"} · {visit.template?.name ?? "Template"}
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
        {(items ?? []).length === 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No se pudieron cargar items del template (RLS o template vacío).
            <div className="mt-1 text-xs text-amber-700">
              template_id: {visit.template_id} · visit_id: {visit.id}
            </div>
          </div>
        ) : null}
        {(items ?? []).map((item) => {
            const response = responseMap.get(item.id);
            return (
              <div key={item.id} className="rounded border p-4">
                <label className="mb-2 block text-sm font-medium">
                  {item.label}
                  {item.required ? " *" : ""}
                </label>
              {String(item.item_type ?? "") === "checkbox" ? (
                  <input
                    type="checkbox"
                    name={`item-${item.id}`}
                    defaultChecked={response?.value_bool ?? false}
                    disabled={isCompleted}
                  />
                ) : null}
              {String(item.item_type ?? "") === "number" ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name={`item-${item.id}`}
                      defaultValue={
                        response?.value_number !== null && response?.value_number !== undefined
                          ? response.value_number
                          : ""
                      }
                      disabled={isCompleted}
                      className="w-full rounded border px-3 py-2"
                    />
                  </div>
                ) : null}
              {String(item.item_type ?? "") === "text" ? (
                  <input
                    type="text"
                    name={`item-${item.id}`}
                    defaultValue={response?.value_text ?? ""}
                    disabled={isCompleted}
                    className="w-full rounded border px-3 py-2"
                  />
                ) : null}
              {String(item.item_type ?? "") === "textarea" ? (
                  <textarea
                    name={`item-${item.id}`}
                    rows={3}
                    defaultValue={response?.value_text ?? ""}
                    disabled={isCompleted}
                    className="w-full rounded border px-3 py-2"
                  />
                ) : null}
              </div>
            );
          })}

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
              <button
                type="submit"
                name="action"
                value="complete"
                className="rounded bg-black px-4 py-2 text-white"
              >
                Completar visita
              </button>
            </div>
          )}
        </form>
      ) : null}
    </div>
  );
}
