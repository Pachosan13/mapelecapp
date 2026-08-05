import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Recibe la telemetría de campo en lote (ver lib/telemetry/fieldEvents).
 *
 * Deliberadamente tonto: valida forma, recorta y escribe. Cualquier error se
 * traga con un 200 — si la telemetría empieza a fallar, el técnico no se puede
 * enterar ni verse afectado. Lo que NO puede pasar es que esto tumbe la app.
 */

const MAX_LOTE = 50;
const EVENTOS_VALIDOS = new Set([
  "drain_start",
  "drain_end",
  "send_fail",
  "complete_blocked",
  "photo_rejected",
]);

type Entrante = {
  visitId?: string | null;
  event?: string;
  payload?: Record<string, unknown>;
  clientTs?: string;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { events?: Entrante[] } | null;
    const entrantes = Array.isArray(body?.events) ? body!.events!.slice(0, MAX_LOTE) : [];
    if (entrantes.length === 0) {
      return NextResponse.json({ ok: true, guardados: 0 });
    }

    const filas = entrantes
      .filter((e) => typeof e.event === "string" && EVENTOS_VALIDOS.has(e.event))
      .map((e) => ({
        visit_id: typeof e.visitId === "string" && e.visitId ? e.visitId : null,
        created_by: user.id,
        event: e.event as string,
        // Cota de tamaño: una métrica nunca justifica un payload gordo.
        payload: JSON.parse(JSON.stringify(e.payload ?? {})).valueOf(),
        client_ts:
          typeof e.clientTs === "string" ? e.clientTs : new Date().toISOString(),
      }))
      .filter((f) => JSON.stringify(f.payload).length <= 2000);

    if (filas.length === 0) {
      return NextResponse.json({ ok: true, guardados: 0 });
    }

    // `tech_events` todavía no está en lib/database.types.ts porque los tipos se
    // generan desde la base y la migración 20260805180000 aún no se aplicó.
    // Cuando se aplique y se regeneren los tipos, este cast se cae solo.
    const { error } = await (supabase as unknown as {
      from: (t: string) => { insert: (rows: unknown[]) => Promise<{ error: unknown }> };
    })
      .from("tech_events")
      .insert(filas);
    if (error) {
      // 200 a propósito: el cliente no debe reintentar en bucle por esto.
      return NextResponse.json({ ok: true, guardados: 0 });
    }
    return NextResponse.json({ ok: true, guardados: filas.length });
  } catch {
    return NextResponse.json({ ok: true, guardados: 0 });
  }
}
