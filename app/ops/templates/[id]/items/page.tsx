import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  error?: string;
};

function parseItemType(value: string) {
  if (value === "checkbox" || value === "number" || value === "text") {
    return value;
  }
  return null;
}

async function createItem(formData: FormData) {
  "use server";

  const supabase = (await createClient()).schema("public");
  const supabaseDb = supabase.schema("public");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const templateId = String(formData.get("template_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const itemType = parseItemType(String(formData.get("item_type") ?? ""));
  const required = formData.get("required") === "on";
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!templateId || !label || !itemType || Number.isNaN(sortOrder)) {
    redirect(
      `/ops/templates/${templateId}/items?error=${encodeURIComponent(
        "Datos inválidos."
      )}`
    );
  }

  const { error } = await supabaseDb.from("template_items").insert({
    template_id: templateId,
    label,
    item_type: itemType,
    required,
    sort_order: sortOrder,
  });

  if (error) {
    redirect(
      `/ops/templates/${templateId}/items?error=${encodeURIComponent(
        "No se pudo crear el item."
      )}`
    );
  }

  redirect(`/ops/templates/${templateId}/items`);
}

async function updateItem(formData: FormData) {
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

  const templateId = String(formData.get("template_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const itemType = parseItemType(String(formData.get("item_type") ?? ""));
  const required = formData.get("required") === "on";
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!templateId || !itemId || !label || !itemType || Number.isNaN(sortOrder)) {
    redirect(
      `/ops/templates/${templateId}/items?error=${encodeURIComponent(
        "Datos inválidos."
      )}`
    );
  }

  const { error } = await supabaseDb
    .from("template_items")
    .update({
      label,
      item_type: itemType,
      required,
      sort_order: sortOrder,
    })
    .eq("id", itemId);

  if (error) {
    redirect(
      `/ops/templates/${templateId}/items?error=${encodeURIComponent(
        "No se pudo actualizar el item."
      )}`
    );
  }

  redirect(`/ops/templates/${templateId}/items`);
}

async function deleteItem(formData: FormData) {
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

  const templateId = String(formData.get("template_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");

  if (!templateId || !itemId) {
    redirect(
      `/ops/templates/${templateId}/items?error=${encodeURIComponent(
        "Datos inválidos."
      )}`
    );
  }

  const { error } = await supabaseDb.from("template_items").delete().eq("id", itemId);

  if (error) {
    redirect(
      `/ops/templates/${templateId}/items?error=${encodeURIComponent(
        "No se pudo borrar el item."
      )}`
    );
  }

  redirect(`/ops/templates/${templateId}/items`);
}

export default async function TemplateItemsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  const supabase = await createClient();

  const { data: template, error: templateError } = await supabase
    .from("visit_templates")
    .select("id,name,category,is_active")
    .eq("id", params.id)
    .maybeSingle();

  if (templateError) {
    return (
      <div className="min-h-screen p-8">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando formulario: {templateError.message}
        </div>
      </div>
    );
  }

  if (!template) {
    notFound();
  }

  const { data: items, error: itemsError } = await supabase
    .from("template_items")
    .select("id,label,item_type,required,sort_order")
    .eq("template_id", template.id)
    .order("sort_order", { ascending: true });

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/templates" className="text-sm text-gray-500">
          ← Volver a formularios
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Campos — {template.name}</h1>
        <p className="text-gray-600">
          Categoría: {template.category} · Activo: {template.is_active ? "Sí" : "No"}
        </p>
      </div>

      {searchParams?.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </div>
      ) : null}

      {itemsError ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Error cargando campos: {itemsError.message}
        </div>
      ) : null}

      <div className="space-y-4">
        {(items ?? []).map((item) => (
          <form
            key={item.id}
            action={updateItem}
            className="rounded border p-4"
          >
            <input type="hidden" name="template_id" value={template.id} />
            <input type="hidden" name="item_id" value={item.id} />
            <div className="grid gap-3 md:grid-cols-5">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Etiqueta</label>
                <input
                  type="text"
                  name="label"
                  defaultValue={item.label}
                  required
                  className="w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Tipo</label>
                <select
                  name="item_type"
                  defaultValue={item.item_type}
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="checkbox">Checkbox</option>
                  <option value="number">Número</option>
                  <option value="text">Texto</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Orden</label>
                <input
                  type="number"
                  name="sort_order"
                  defaultValue={item.sort_order}
                  className="w-full rounded border px-3 py-2"
                />
              </div>
              <div className="flex items-center gap-2 md:mt-6">
                <input
                  type="checkbox"
                  name="required"
                  defaultChecked={item.required ?? false}
                />
                <span className="text-sm">Requerido</span>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="submit" className="rounded bg-black px-4 py-2 text-white">
                Guardar
              </button>
              <button
                type="submit"
                formAction={deleteItem}
                className="rounded border border-red-500 px-4 py-2 text-red-600"
              >
                Eliminar
              </button>
            </div>
          </form>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Nuevo campo</h2>
        <form action={createItem} className="rounded border p-4">
          <input type="hidden" name="template_id" value={template.id} />
          <div className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Etiqueta</label>
              <input
                type="text"
                name="label"
                required
                className="w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tipo</label>
              <select name="item_type" className="w-full rounded border px-3 py-2">
                <option value="checkbox">Checkbox</option>
                <option value="number">Número</option>
                <option value="text">Texto</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Orden</label>
              <input
                type="number"
                name="sort_order"
                defaultValue={0}
                className="w-full rounded border px-3 py-2"
              />
            </div>
            <div className="flex items-center gap-2 md:mt-6">
              <input type="checkbox" name="required" />
              <span className="text-sm">Requerido</span>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" className="rounded bg-black px-4 py-2 text-white">
              Agregar campo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
