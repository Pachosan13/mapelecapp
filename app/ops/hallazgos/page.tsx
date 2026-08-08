import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { fetchAllRows } from "@/lib/db/fetchAllRows";
import { groupOf } from "@/lib/bombas/checklistFilter";

/**
 * Bandeja de hallazgos — Fase 1: SOLO LECTURA sobre lo que ya se captura.
 *
 * De dónde sale (7-ago-2026): revisando la data salió que hay **92 casillas marcadas
 * "Falla" en 29 edificios** y nadie tiene una pantalla donde verlas. Cada una ya viene
 * atada a su ítem, su equipo, su edificio y su fecha — el dato estaba estructurado desde
 * el principio, lo que faltaba era enseñarlo. Y aparte, 15 observaciones de texto libre
 * traen una acción vendible ("se recomienda el reemplazo del relay alternador") enterrada
 * en un campo que nadie puede consultar.
 *
 * Lo que MÁS vale acá es la vista de repetidos: la misma falla —"Rociadores · Válvulas de
 * control - Provistas de identificación apropiada"— aparece en **16 edificios**. Eso no
 * son 16 trabajitos sueltos, es un solo producto vendido 16 veces, y solo se ve mirando a
 * través de los edificios.
 *
 * Deliberadamente NO hace:
 *  · No cambia nada del formulario del técnico. Cero riesgo en campo.
 *  · No manda alertas. Con ~300 edificios avisar por cada falla mata la adopción — ya se
 *    decidió así en el spec (9-jun). Esto se consulta, no timbra.
 *  · No parsea las observaciones de texto libre para crear registros. Se muestran aparte,
 *    marcadas "por revisar", para que un humano las convierta. Un regex no crea un
 *    compromiso comercial.
 *
 * Fase 2 (no acá): tabla `finding_status` para marcar abierto/cotizado/descartado, SIN
 * tocar `visit_responses`, que es append-only e idempotente.
 */

export const dynamic = "force-dynamic";

const PANAMA_TIME_ZONE = "America/Panama";

const fechaCorta = (valor?: string | null) => {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("es-PA", {
    timeZone: PANAMA_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(valor));
};

// Una observación "vendible" es la que propone hacer algo, no la que solo describe.
// Mismo criterio con el que se midió el volumen; si falla, falla mostrando de más
// (un humano la descarta en un segundo) y nunca de menos.
const PIDE_ACCION =
  /recomien|remplaz|reemplaz|cambio de|cambiar|instalar|corregir|coordinar/i;

type VisitaMin = {
  id: string;
  building_id: string | null;
  completed_at: string | null;
  assigned_tech_user_id: string | null;
};

type Hallazgo = {
  visitId: string;
  edificio: string;
  edificioId: string;
  fecha: string | null;
  tecnico: string;
  seccion: string;
  detalle: string;
  etiqueta: string;
};

export default async function HallazgosPage({
  searchParams,
}: {
  searchParams?: { vista?: string };
}) {
  await requireRole(["ops_manager", "director"]);
  const supabase = (await createClient()).schema("public");

  const vista = searchParams?.vista === "repetidos" ? "repetidos" : "edificio";

  // ── Visitas completadas, con su edificio y su técnico ──
  const { data: visitas } = await fetchAllRows<VisitaMin>((desde, hasta) =>
    supabase
      .from("visits")
      .select("id,building_id,completed_at,assigned_tech_user_id")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .range(desde, hasta)
  );

  if (!visitas.length) {
    return (
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold">Hallazgos</h1>
        <p className="mt-2 text-sm text-gray-500">
          Todavía no hay visitas completadas.
        </p>
      </div>
    );
  }

  const visitaPorId = new Map(visitas.map((v) => [v.id, v]));
  const visitIds = visitas.map((v) => v.id);
  const buildingIds = Array.from(
    new Set(visitas.map((v) => v.building_id).filter(Boolean))
  ) as string[];
  const techIds = Array.from(
    new Set(visitas.map((v) => v.assigned_tech_user_id).filter(Boolean))
  ) as string[];

  const [{ data: edificios }, { data: perfiles }] = await Promise.all([
    fetchAllRows<{ id: string; name: string | null }>((desde, hasta) =>
      supabase.from("buildings").select("id,name").in("id", buildingIds).range(desde, hasta)
    ),
    techIds.length
      ? fetchAllRows<{ user_id: string; full_name: string | null }>((desde, hasta) =>
          supabase
            .from("profiles")
            .select("user_id,full_name")
            .in("user_id", techIds)
            .range(desde, hasta)
        )
      : Promise.resolve({ data: [], error: null }),
  ]);

  const nombreEdificio = new Map(edificios.map((b) => [b.id, b.name?.trim() || "Sin nombre"]));
  const nombreTecnico = new Map(
    perfiles.map((p) => [p.user_id, p.full_name?.trim() || "—"])
  );

  // ── Las casillas marcadas "Falla" ──
  const { data: fallas } = await fetchAllRows<{
    visit_id: string | null;
    item_id: string | null;
  }>((desde, hasta) =>
    supabase
      .from("visit_responses")
      .select("visit_id,item_id")
      .eq("value_bool", false)
      .in("visit_id", visitIds)
      .range(desde, hasta)
  );

  // ── Los ítems de "Observaciones" de cada plantilla, para leer su texto ──
  const { data: itemsObs } = await fetchAllRows<{ id: string; label: string }>(
    (desde, hasta) =>
      supabase
        .from("template_items")
        .select("id,label")
        .ilike("label", "%observaci%")
        .range(desde, hasta)
  );
  const idsObs = itemsObs.map((i) => i.id);

  const { data: respuestasObs } = idsObs.length
    ? await fetchAllRows<{
        visit_id: string | null;
        item_id: string | null;
        value_text: string | null;
      }>((desde, hasta) =>
        supabase
          .from("visit_responses")
          .select("visit_id,item_id,value_text")
          .in("item_id", idsObs)
          .in("visit_id", visitIds)
          .range(desde, hasta)
      )
    : { data: [] as never[] };

  // ── Etiquetas de los ítems que fallaron ──
  const idsFalla = Array.from(
    new Set(fallas.map((f) => f.item_id).filter(Boolean))
  ) as string[];
  const { data: itemsFalla } = idsFalla.length
    ? await fetchAllRows<{ id: string; label: string; item_type: string }>(
        (desde, hasta) =>
          supabase
            .from("template_items")
            .select("id,label,item_type")
            .in("id", idsFalla)
            .range(desde, hasta)
      )
    : { data: [] as never[] };
  const itemPorId = new Map(itemsFalla.map((i) => [i.id, i]));

  // ── Armar los hallazgos ──
  const hallazgos: Hallazgo[] = [];
  for (const f of fallas) {
    if (!f.visit_id || !f.item_id) continue;
    const item = itemPorId.get(f.item_id);
    // Solo casillas: un `false` en otro tipo de ítem no es una falla de inspección.
    if (!item || item.item_type !== "checkbox") continue;
    const visita = visitaPorId.get(f.visit_id);
    if (!visita?.building_id) continue;
    const seccion = groupOf(item.label);
    const detalle = item.label.includes(" - ")
      ? item.label.slice(item.label.indexOf(" - ") + 3)
      : item.label;
    hallazgos.push({
      visitId: visita.id,
      edificioId: visita.building_id,
      edificio: nombreEdificio.get(visita.building_id) ?? "Sin nombre",
      fecha: visita.completed_at,
      tecnico: visita.assigned_tech_user_id
        ? (nombreTecnico.get(visita.assigned_tech_user_id) ?? "—")
        : "—",
      seccion,
      detalle,
      etiqueta: item.label,
    });
  }
  hallazgos.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));

  // ── Observaciones de texto libre que proponen una acción ──
  const observaciones = respuestasObs
    .map((r) => {
      const texto = (r.value_text ?? "").trim();
      if (!texto || !PIDE_ACCION.test(texto)) return null;
      const visita = r.visit_id ? visitaPorId.get(r.visit_id) : null;
      if (!visita?.building_id) return null;
      return {
        visitId: visita.id,
        edificio: nombreEdificio.get(visita.building_id) ?? "Sin nombre",
        fecha: visita.completed_at,
        tecnico: visita.assigned_tech_user_id
          ? (nombreTecnico.get(visita.assigned_tech_user_id) ?? "—")
          : "—",
        texto,
      };
    })
    .filter(Boolean) as Array<{
    visitId: string;
    edificio: string;
    fecha: string | null;
    tecnico: string;
    texto: string;
  }>;
  observaciones.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));

  // ── Vista por edificio ──
  const porEdificio = new Map<string, Hallazgo[]>();
  for (const h of hallazgos) {
    const lista = porEdificio.get(h.edificio) ?? [];
    lista.push(h);
    porEdificio.set(h.edificio, lista);
  }
  const edificiosOrdenados = [...porEdificio.entries()].sort(
    (a, b) => b[1].length - a[1].length
  );

  // ── Vista de repetidos: la misma falla en varios edificios ──
  const porEtiqueta = new Map<string, Hallazgo[]>();
  for (const h of hallazgos) {
    const lista = porEtiqueta.get(h.etiqueta) ?? [];
    lista.push(h);
    porEtiqueta.set(h.etiqueta, lista);
  }
  const repetidos = [...porEtiqueta.entries()]
    .map(([etiqueta, lista]) => ({
      etiqueta,
      seccion: lista[0].seccion,
      detalle: lista[0].detalle,
      edificios: Array.from(new Set(lista.map((h) => h.edificio))).sort(),
      veces: lista.length,
    }))
    .filter((r) => r.edificios.length > 1)
    .sort((a, b) => b.edificios.length - a.edificios.length);

  const totalEdificios = new Set(hallazgos.map((h) => h.edificioId)).size;

  const tab = (destino: string, texto: string, activo: boolean) => (
    <Link
      href={`/ops/hallazgos?vista=${destino}`}
      className={`rounded-full px-4 py-2 text-sm font-medium ${
        activo ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-700"
      }`}
    >
      {texto}
    </Link>
  );

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Hallazgos</h1>
        <p className="mt-1 text-gray-600">
          Todo lo que los técnicos marcaron como falla, junto. Sale de las visitas ya
          completadas — no hay que registrar nada aparte.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded border p-4">
          <p className="text-2xl font-semibold">{hallazgos.length}</p>
          <p className="text-xs text-gray-500">fallas registradas</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-2xl font-semibold">{totalEdificios}</p>
          <p className="text-xs text-gray-500">edificios con al menos una</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-2xl font-semibold">{repetidos.length}</p>
          <p className="text-xs text-gray-500">fallas que se repiten en varios edificios</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {tab("edificio", "Por edificio", vista === "edificio")}
        {tab("repetidos", "Repetidas en varios edificios", vista === "repetidos")}
      </div>

      {vista === "repetidos" ? (
        <div className="rounded border">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="w-1/2 px-4 py-3 font-medium">Qué falla</th>
                <th className="w-16 px-4 py-3 font-medium">Edif.</th>
                <th className="px-4 py-3 font-medium">Dónde</th>
              </tr>
            </thead>
            <tbody>
              {repetidos.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={3}>
                    Ninguna falla se repite todavía en más de un edificio.
                  </td>
                </tr>
              ) : (
                repetidos.map((r) => (
                  <tr key={r.etiqueta} className="border-t align-top">
                    <td className="break-words px-4 py-3">
                      <p className="font-medium">{r.detalle}</p>
                      <p className="text-xs text-gray-500">{r.seccion}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {r.edificios.length}
                      </span>
                    </td>
                    <td className="break-words px-4 py-3 text-gray-700">
                      {r.edificios.join(" · ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {edificiosOrdenados.length === 0 ? (
            <p className="rounded border p-6 text-sm text-gray-500">
              No hay fallas registradas en las visitas completadas.
            </p>
          ) : (
            edificiosOrdenados.map(([edificio, lista]) => (
              <div key={edificio} className="rounded border">
                <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
                  <p className="font-semibold">{edificio}</p>
                  <span className="text-xs text-gray-500">
                    {lista.length} {lista.length === 1 ? "falla" : "fallas"}
                  </span>
                </div>
                <ul className="divide-y">
                  {lista.map((h, i) => (
                    <li
                      key={`${h.visitId}-${h.etiqueta}-${i}`}
                      className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{h.detalle}</p>
                        <p className="text-xs text-gray-500">
                          {h.seccion} · {fechaCorta(h.fecha)} · {h.tecnico}
                        </p>
                      </div>
                      <Link
                        href={`/ops/visits/${h.visitId}/report`}
                        className="rounded border px-3 py-1.5 text-xs"
                      >
                        Ver visita
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Observaciones por revisar</h2>
        <p className="mt-1 text-sm text-gray-600">
          Texto que el técnico escribió a mano y que propone hacer algo. No se interpretan
          solas — léelas y decide.
        </p>
        <div className="mt-3 space-y-3">
          {observaciones.length === 0 ? (
            <p className="rounded border p-6 text-sm text-gray-500">
              Sin observaciones que propongan una acción.
            </p>
          ) : (
            observaciones.map((o, i) => (
              <div key={`${o.visitId}-${i}`} className="rounded border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{o.edificio}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {fechaCorta(o.fecha)} · {o.tecnico}
                    </span>
                    <Link
                      href={`/ops/visits/${o.visitId}/report`}
                      className="rounded border px-3 py-1.5 text-xs"
                    >
                      Ver visita
                    </Link>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{o.texto}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
