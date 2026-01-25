import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

type SearchParams = {
  error?: string;
};

async function startVisit(formData: FormData) {
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

  const { data: visit } = await supabase
    .from("visits")
    .select("id,assigned_tech_user_id,status")
    .eq("id", visitId)
    .maybeSingle();

  if (!visit || visit.assigned_tech_user_id !== user.id) {
    redirect("/unauthorized");
  }

  if (visit.status === "planned") {
    await supabase
      .from("visits")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", visitId);
  }

  redirect(`/tech/visits/${visitId}`);
}

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
    .select("id,item_type,required,sort_order")
    .eq("template_id", visit.template_id)
    .order("sort_order", { ascending: true });

  const errors: string[] = [];
  const responses =
    (items ?? []).map((item) => {
      const fieldKey = `item-${item.id}`;
      if (item.item_type === "checkbox") {
        const checked = formData.get(fieldKey) === "on";
        if (action === "complete" && item.required && !checked) {
          errors.push(item.id);
        }
        return {
          visit_id: visit.id,
          item_id: item.id,
          value_bool: checked,
          value_number: null,
          value_text: null,
        };
      }

      if (item.item_type === "number") {
        const raw = String(formData.get(fieldKey) ?? "").trim();
        const value = raw ? Number(raw) : null;
        if (action === "complete" && item.required && (!raw || Number.isNaN(value))) {
          errors.push(item.id);
        }
        return {
          visit_id: visit.id,
          item_id: item.id,
          value_number: Number.isNaN(value as number) ? null : value,
          value_text: null,
          value_bool: null,
        };
      }

      const rawText = String(formData.get(fieldKey) ?? "").trim();
      if (action === "complete" && item.required && !rawText) {
        errors.push(item.id);
      }
      return {
        visit_id: visit.id,
        item_id: item.id,
        value_text: rawText || null,
        value_number: null,
        value_bool: null,
      };
    }) ?? [];

  if (action === "complete" && errors.length > 0) {
    redirect(
      `/tech/visits/${visitId}?error=${encodeURIComponent(
        "Completa los campos requeridos."
      )}`
    );
  }

  const { error: upsertError } = await supabase
    .from("visit_responses")
    .upsert(responses, { onConflict: "visit_id,item_id" });

  if (upsertError) {
    redirect(
      `/tech/visits/${visitId}?error=${encodeURIComponent(
        "No se pudieron guardar las respuestas."
      )}`
    );
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
      redirect(
        `/tech/visits/${visitId}?error=${encodeURIComponent(
          "No se pudo completar la visita."
        )}`
      );
    }
  }

  redirect(`/tech/visits/${visitId}`);
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
      "id,status,scheduled_for,started_at,completed_at,assigned_tech_user_id,building:buildings(id,name),template:visit_templates(id,name)"
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
    .eq("template_id", visit.template?.id)
    .order("sort_order", { ascending: true });

  const { data: responses } = await supabase
    .from("visit_responses")
    .select("item_id,value_text,value_number,value_bool")
    .eq("visit_id", visit.id);

  const responseMap = new Map(
    (responses ?? []).map((response) => [response.item_id, response])
  );

  const isCompleted = visit.status === "completed";

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/tech/today" className="text-sm text-gray-500">
          ← Volver a hoy
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Visita</h1>
        <p className="text-gray-600">
          {visit.building?.name ?? "Building"} · {visit.template?.name ?? "Template"}
        </p>
      </div>

      {searchParams?.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </div>
      ) : null}

      <div className="mb-6 rounded border p-4 text-sm text-gray-700">
        <div>Scheduled for: {visit.scheduled_for}</div>
        <div>Status: {visit.status}</div>
      </div>

      {visit.status === "planned" ? (
        <form action={startVisit} className="mb-6">
          <input type="hidden" name="visit_id" value={visit.id} />
          <button type="submit" className="rounded bg-black px-4 py-2 text-white">
            Start
          </button>
        </form>
      ) : null}

      <form action={handleResponses} className="space-y-4 max-w-2xl">
        <input type="hidden" name="visit_id" value={visit.id} />
        {(items ?? []).map((item) => {
          const response = responseMap.get(item.id);
          return (
            <div key={item.id} className="rounded border p-4">
              <label className="mb-2 block text-sm font-medium">
                {item.label}
                {item.required ? " *" : ""}
              </label>
              {item.item_type === "checkbox" ? (
                <input
                  type="checkbox"
                  name={`item-${item.id}`}
                  defaultChecked={response?.value_bool ?? false}
                  disabled={isCompleted}
                />
              ) : null}
              {item.item_type === "number" ? (
                <input
                  type="number"
                  name={`item-${item.id}`}
                  defaultValue={response?.value_number ?? ""}
                  disabled={isCompleted}
                  className="w-full rounded border px-3 py-2"
                />
              ) : null}
              {item.item_type === "text" ? (
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
              className="rounded border px-4 py-2 text-gray-700"
            >
              Guardar
            </button>
            <button
              type="submit"
              name="action"
              value="complete"
              className="rounded bg-black px-4 py-2 text-white"
            >
              Complete
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
