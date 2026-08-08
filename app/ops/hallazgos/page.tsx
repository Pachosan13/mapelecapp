import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { fetchAllRows } from "@/lib/db/fetchAllRows";
import { groupOf } from "@/lib/bombas/checklistFilter";

/**
 * Bandeja de hallazgos.
 *
 * FASE 1 (7-ago-2026) — enseñar lo que ya se captura. Hay 92 casillas marcadas "Falla"
 * en 29 edificios, cada una atada a su ítem, su equipo, su edificio y su fecha. El dato
 * estaba estructurado desde el principio; lo que faltaba era la pantalla. Y 15
 * observaciones de texto libre traen una acción vendible enterrada en un campo que nadie
 * podía consultar. Lo que más vale es la vista de repetidos: "Rociadores · Válvulas de
 * control - Provistas de identificación apropiada" falla en 16 edificios — no son 16
 * trabajitos, es un producto vendido 16 veces.
 *
 * FASE 2 (8-ago-2026) — darle estado. Sin esto la bandeja era un reporte: se miraba y no
 * se podía hacer nada, así que William tendría que acordarse de memoria cuáles ya cotizó —
 * el mismo problema, movido un casillero. Ahora cada hallazgo se marca abierto / cotizado
 * / aprobado / descartado, con nota.
 *
 * El estado vive en `finding_status`, tabla aparte, identificado por (visit_id, item_id).
 * NO es una columna de `visit_responses`: esa tabla es append-only y el outbox del técnico
 * la reescribe desde el campo — un reintento pisaría la decisión comercial. La respuesta
 * del técnico y la decisión de ops tienen dueños y ciclos de vida distintos.
 *
 * Sigue sin hacer: no alerta a nadie (con ~300 edificios timbrar por cada falla mata la
 * adopción, decidido en el spec del 9-jun) y no parsea las observaciones para crear
 * registros — un regex no crea un compromiso comercial.
 */

export const dynamic = "force-dynamic";

const PANAMA_TIME_ZONE = "America/Panama";

const ESTADOS = ["abierto", "cotizado", "aprobado", "descartado"] as const;
type Estado = (typeof ESTADOS)[number];

const ETIQUETA_ESTADO: Record<Estado, string> = {
  abierto: "Abierto",
  cotizado: "Cotizado",
  aprobado: "Aprobado",
  descartado: "Descartado",
};

const COLOR_ESTADO: Record<Estado, string> = {
  abierto: "bg-amber-100 text-amber-800",
  cotizado: "bg-blue-100 text-blue-800",
  aprobado: "bg-green-100 text-green-800",
  descartado: "bg-gray-100 text-gray-600",
};

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
// Si se equivoca, se equivoca mostrando de más — un humano la descarta en un segundo.
const PIDE_ACCION =
  /recomien|remplaz|reemplaz|cambio de|cambiar|instalar|corregir|coordinar/i;

/** La clave de un hallazgo. Es el mismo par con el que el outbox hace upsert. */
const clave = (visitId: string, itemId: string) => `${visitId}:${itemId}`;

// `finding_status` no está en los tipos generados (igual que `tech_events`, ver
// app/api/tech/events/route.ts). Se accede con una vista mínima y tipada a mano.
type FilaEstado = {
  visit_id: string;
  item_id: string;
  estado: Estado;
  nota: string | null;
};

type ClienteSuelto = {
  from: (t: string) => {
    select: (c: string) => {
      range: (
        d: number,
        h: number
      ) => PromiseLike<{ data: FilaEstado[] | null; error: unknown }>;
    };
    upsert: (
      fila: Record<string, unknown>,
      opts: { onConflict: string }
    ) => Promise<{ error: unknown }>;
  };
};

async function guardarEstado(formData: FormData) {
  "use server";

  // Marcar "cotizado" es un compromiso: solo ops_manager. El director mira.
  const user = await getCurrentUser();
  const destino = String(formData.get("volver") ?? "/ops/hallazgos");
  if (!user || user.role !== "ops_manager") {
    redirect(destino);
  }

  const visitId = String(formData.get("visit_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");
  const estadoCrudo = String(formData.get("estado") ?? "");
  const nota = String(formData.get("nota") ?? "").trim();

  if (!visitId || !itemId || !ESTADOS.includes(estadoCrudo as Estado)) {
    redirect(destino);
  }

  const db = (await createClient()).schema("public") as unknown as ClienteSuelto;
  await db.from("finding_status").upsert(
    {
      visit_id: visitId,
      item_id: itemId,
      estado: estadoCrudo,
      nota: nota || null,
      updated_by: user.id,
    },
    { onConflict: "visit_id,item_id" }
  );

  revalidatePath("/ops/hallazgos");
  redirect(destino);
}

type VisitaMin = {
  id: string;
  building_id: string | null;
  completed_at: string | null;
  assigned_tech_user_id: string | null;
};

type Hallazgo = {
  visitId: string;
  itemId: string;
  edificio: string;
  edificioId: string;
  fecha: string | null;
  tecnico: string;
  seccion: string;
  detalle: string;
  etiqueta: string;
  estado: Estado;
  nota: string | null;
};

export default async function HallazgosPage({
  searchParams,
}: {
  searchParams?: { vista?: string; estado?: string };
}) {
  const { user } = await requireRole(["ops_manager", "director"]);
  const puedeEditar = user.role === "ops_manager";
  const supabase = (await createClient()).schema("public");

  const vista = searchParams?.vista === "repetidos" ? "repetidos" : "edificio";
  const filtro = searchParams?.estado === "todos" ? "todos" : "abiertos";
  const urlActual = `/ops/hallazgos?vista=${vista}&estado=${filtro}`;

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
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);

  const nombreEdificio = new Map(
    edificios.map((b) => [b.id, b.name?.trim() || "Sin nombre"])
  );
  const nombreTecnico = new Map(
    perfiles.map((p) => [p.user_id, p.full_name?.trim() || "—"])
  );

  // Estado guardado. La ausencia de fila significa "abierto" — no se siembra nada.
  const dbSuelto = supabase as unknown as ClienteSuelto;
  const { data: estados } = await fetchAllRows<FilaEstado>((desde, hasta) =>
    dbSuelto
      .from("finding_status")
      .select("visit_id,item_id,estado,nota")
      .range(desde, hasta)
  );
  const estadoPorClave = new Map(estados.map((e) => [clave(e.visit_id, e.item_id), e]));

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
  const todos: Hallazgo[] = [];
  for (const f of fallas) {
    if (!f.visit_id || !f.item_id) continue;
    const item = itemPorId.get(f.item_id);
    // Solo casillas: un `false` en otro tipo de ítem no es una falla de inspección.
    if (!item || item.item_type !== "checkbox") continue;
    const visita = visitaPorId.get(f.visit_id);
    if (!visita?.building_id) continue;
    const guardado = estadoPorClave.get(clave(f.visit_id, f.item_id));
    todos.push({
      visitId: visita.id,
      itemId: f.item_id,
      edificioId: visita.building_id,
      edificio: nombreEdificio.get(visita.building_id) ?? "Sin nombre",
      fecha: visita.completed_at,
      tecnico: visita.assigned_tech_user_id
        ? (nombreTecnico.get(visita.assigned_tech_user_id) ?? "—")
        : "—",
      seccion: groupOf(item.label),
      detalle: item.label.includes(" - ")
        ? item.label.slice(item.label.indexOf(" - ") + 3)
        : item.label,
      etiqueta: item.label,
      estado: guardado?.estado ?? "abierto",
      nota: guardado?.nota ?? null,
    });
  }
  todos.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));

  const abiertos = todos.filter((h) => h.estado === "abierto");
  const cerrados = todos.length - abiertos.length;
  const hallazgos = filtro === "todos" ? todos : abiertos;

  // ── Observaciones de texto libre con acción propuesta ──
  const observacionesTodas = respuestasObs
    .map((r) => {
      const texto = (r.value_text ?? "").trim();
      if (!texto || !PIDE_ACCION.test(texto)) return null;
      if (!r.visit_id || !r.item_id) return null;
      const visita = visitaPorId.get(r.visit_id);
      if (!visita?.building_id) return null;
      const guardado = estadoPorClave.get(clave(r.visit_id, r.item_id));
      return {
        visitId: visita.id,
        itemId: r.item_id,
        edificio: nombreEdificio.get(visita.building_id) ?? "Sin nombre",
        fecha: visita.completed_at,
        tecnico: visita.assigned_tech_user_id
          ? (nombreTecnico.get(visita.assigned_tech_user_id) ?? "—")
          : "—",
        texto,
        estado: (guardado?.estado ?? "abierto") as Estado,
        nota: guardado?.nota ?? null,
      };
    })
    .filter(Boolean) as Array<{
    visitId: string;
    itemId: string;
    edificio: string;
    fecha: string | null;
    tecnico: string;
    texto: string;
    estado: Estado;
    nota: string | null;
  }>;
  observacionesTodas.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
  const observaciones =
    filtro === "todos"
      ? observacionesTodas
      : observacionesTodas.filter((o) => o.estado === "abierto");

  // ── Agrupaciones ──
  const porEdificio = new Map<string, Hallazgo[]>();
  for (const h of hallazgos) {
    const lista = porEdificio.get(h.edificio) ?? [];
    lista.push(h);
    porEdificio.set(h.edificio, lista);
  }
  const edificiosOrdenados = [...porEdificio.entries()].sort(
    (a, b) => b[1].length - a[1].length
  );

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

  const edificiosConAbiertos = new Set(abiertos.map((h) => h.edificioId)).size;

  // ── Controles ──
  const Chip = ({ estado }: { estado: Estado }) => (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[estado]}`}
    >
      {ETIQUETA_ESTADO[estado]}
    </span>
  );

  const ControlEstado = ({
    visitId,
    itemId,
    estado,
    nota,
  }: {
    visitId: string;
    itemId: string;
    estado: Estado;
    nota: string | null;
  }) => {
    if (!puedeEditar) return <Chip estado={estado} />;
    return (
      <form action={guardarEstado} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="visit_id" value={visitId} />
        <input type="hidden" name="item_id" value={itemId} />
        <input type="hidden" name="volver" value={urlActual} />
        <select
          name="estado"
          defaultValue={estado}
          className="rounded border px-2 py-1 text-xs"
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO[e]}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="nota"
          defaultValue={nota ?? ""}
          placeholder="nota (opcional)"
          className="w-40 rounded border px-2 py-1 text-xs"
        />
        <button
          type="submit"
          className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium"
        >
          Guardar
        </button>
      </form>
    );
  };

  const tabVista = (destino: string, texto: string, activo: boolean) => (
    <Link
      href={`/ops/hallazgos?vista=${destino}&estado=${filtro}`}
      className={`rounded-full px-4 py-2 text-sm font-medium ${
        activo ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-700"
      }`}
    >
      {texto}
    </Link>
  );

  const tabEstado = (destino: string, texto: string, activo: boolean) => (
    <Link
      href={`/ops/hallazgos?vista=${vista}&estado=${destino}`}
      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
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
          Todo lo que los técnicos marcaron como falla, junto. Márcalo cotizado o
          descartado para que deje de aparecer como pendiente.
        </p>
        {!puedeEditar ? (
          <p className="mt-2 text-xs text-gray-500">
            Estás viendo en modo lectura. Marcar hallazgos es del gerente de operaciones.
          </p>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="rounded border p-4">
          <p className="text-2xl font-semibold">{abiertos.length}</p>
          <p className="text-xs text-gray-500">abiertos</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-2xl font-semibold">{cerrados}</p>
          <p className="text-xs text-gray-500">ya revisados</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-2xl font-semibold">{edificiosConAbiertos}</p>
          <p className="text-xs text-gray-500">edificios con pendientes</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-2xl font-semibold">{repetidos.length}</p>
          <p className="text-xs text-gray-500">fallas repetidas entre edificios</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {tabVista("edificio", "Por edificio", vista === "edificio")}
        {tabVista("repetidos", "Repetidas en varios edificios", vista === "repetidos")}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">Mostrar:</span>
        {tabEstado("abiertos", "Solo abiertos", filtro === "abiertos")}
        {tabEstado("todos", "Todos", filtro === "todos")}
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
                    Ninguna falla se repite en más de un edificio con este filtro.
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
          <p className="border-t px-4 py-3 text-xs text-gray-500">
            Esta vista agrupa; para marcar el estado usa &ldquo;Por edificio&rdquo;.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {edificiosOrdenados.length === 0 ? (
            <p className="rounded border p-6 text-sm text-gray-500">
              {filtro === "abiertos"
                ? "No queda ningún hallazgo abierto."
                : "No hay fallas registradas en las visitas completadas."}
            </p>
          ) : (
            edificiosOrdenados.map(([edificio, lista]) => (
              <div key={edificio} className="rounded border">
                <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
                  <p className="font-semibold">{edificio}</p>
                  <span className="text-xs text-gray-500">
                    {lista.length} {lista.length === 1 ? "hallazgo" : "hallazgos"}
                  </span>
                </div>
                <ul className="divide-y">
                  {lista.map((h) => (
                    <li key={`${h.visitId}-${h.itemId}`} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{h.detalle}</p>
                            {filtro === "todos" ? <Chip estado={h.estado} /> : null}
                          </div>
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
                      </div>
                      <div className="mt-2">
                        <ControlEstado
                          visitId={h.visitId}
                          itemId={h.itemId}
                          estado={h.estado}
                          nota={h.nota}
                        />
                      </div>
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
          Texto que el técnico escribió a mano y que propone hacer algo. Ojo: un mismo
          bloque puede traer varias recomendaciones — el estado aplica al bloque entero.
        </p>
        <div className="mt-3 space-y-3">
          {observaciones.length === 0 ? (
            <p className="rounded border p-6 text-sm text-gray-500">
              {filtro === "abiertos"
                ? "No queda ninguna observación por revisar."
                : "Sin observaciones que propongan una acción."}
            </p>
          ) : (
            observaciones.map((o) => (
              <div key={`${o.visitId}-${o.itemId}`} className="rounded border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{o.edificio}</p>
                    {filtro === "todos" ? <Chip estado={o.estado} /> : null}
                  </div>
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
                <div className="mt-3">
                  <ControlEstado
                    visitId={o.visitId}
                    itemId={o.itemId}
                    estado={o.estado}
                    nota={o.nota}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
