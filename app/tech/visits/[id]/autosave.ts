"use server";

import { createClient, getCurrentUser } from "@/lib/supabase/server";

type AutosavePayload = {
  visitId: string;
  kind: "response" | "notes";
  itemId?: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBool?: boolean | null;
  notes?: string | null;
};

export type AutosaveResult = { ok: boolean; at?: string; error?: string };

/**
 * Autosave incremental de una sola respuesta (o de las notas) de una visita.
 *
 * - Usa el cliente Supabase ligado a las cookies del técnico → la RLS decide
 *   si puede escribir (mismo modelo que "Guardar"/"Completar", no bypass).
 * - `visit_responses` es append-only: cada autosave inserta una fila nueva y la
 *   vista `visit_latest_responses` resuelve a la última (última gana). No hay
 *   duplicados desde el punto de vista de lectura.
 * - NO llama a revalidatePath: no queremos re-render que resetee los inputs
 *   mientras el técnico escribe. Es persistencia silenciosa en segundo plano.
 */
export async function autosaveResponse(
  payload: AutosavePayload
): Promise<AutosaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "no-auth" };
  if (!payload.visitId) return { ok: false, error: "no-visit" };

  const supabase = await createClient();

  if (payload.kind === "notes") {
    const { error } = await supabase
      .from("visits")
      .update({ notes: payload.notes ?? null })
      .eq("id", payload.visitId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, at: new Date().toISOString() };
  }

  if (!payload.itemId) return { ok: false, error: "no-item" };

  const row = {
    visit_id: payload.visitId,
    item_id: payload.itemId,
    value_text: payload.valueText ?? null,
    value_number:
      payload.valueNumber === undefined || payload.valueNumber === null
        ? null
        : Number.isNaN(payload.valueNumber)
        ? null
        : payload.valueNumber,
    value_bool:
      payload.valueBool === undefined ? null : payload.valueBool,
    created_by: user.id,
  };

  const { error } = await supabase.from("visit_responses").insert(row);
  if (error) return { ok: false, error: error.message };
  return { ok: true, at: new Date().toISOString() };
}
