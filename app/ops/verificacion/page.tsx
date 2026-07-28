import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { equipoSinVerificar } from "@/lib/bombas/checklistFilter";

// Los edificios cuyo inventario entró por lectura automática de las hojas de
// mantenimiento y que SEMCO todavía no revisó.
//
// Existe por dos razones. La que pidió William (28-jul): "¿hay alguna forma de saber
// cuáles sí logró cargar el sistema, para ver si los equipos son los correctos?".
// Y una que le faltaba al circuito: mientras un edificio tenga equipos sin verificar,
// su formulario NO se filtra (sale la plantilla completa, ver buildBuildingScope).
// Sin un botón para decir "ya lo revisé", el filtro no se encendía nunca.

type EquipoFila = {
  id: string;
  name: string | null;
  building_id: string;
  specs: unknown;
  buildings: { name: string | null } | null;
};

async function marcarVerificado(formData: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user || user.role === "director") redirect("/ops/verificacion");

  const buildingId = String(formData.get("building_id") ?? "");
  const db = (await createClient()).schema("public");
  const { data: equipos } = await db
    .from("equipment")
    .select("id,specs")
    .eq("building_id", buildingId);

  // `specs` es jsonb libre: se mezcla, no se reemplaza, para no perder los datos de
  // placa ni `origen` (de qué hoja salió el equipo, que es lo que permite revertir).
  for (const eq of equipos ?? []) {
    if (!equipoSinVerificar({ name: null, system: null, specs: eq.specs })) continue;
    const specs = { ...(eq.specs as Record<string, unknown>), verificado: true };
    await db.from("equipment").update({ specs }).eq("id", eq.id);
  }

  revalidatePath("/ops/verificacion");
  revalidatePath(`/ops/buildings/${buildingId}/equipment`);
}

export default async function VerificacionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isReadOnly = user.role === "director";

  const db = (await createClient()).schema("public");
  const { data } = await db
    .from("equipment")
    .select("id,name,building_id,specs,buildings(name)")
    .not("specs->origen", "is", null);

  const filas = (data ?? []) as unknown as EquipoFila[];

  const porEdificio = new Map<
    string,
    { nombre: string; total: number; pendientes: number; hojas: Set<string> }
  >();
  for (const f of filas) {
    const actual = porEdificio.get(f.building_id) ?? {
      nombre: f.buildings?.name ?? "(sin nombre)",
      total: 0,
      pendientes: 0,
      hojas: new Set<string>(),
    };
    actual.total += 1;
    if (equipoSinVerificar({ name: f.name, system: null, specs: f.specs }))
      actual.pendientes += 1;
    const hoja = (f.specs as { origen?: { hoja?: string } })?.origen?.hoja;
    if (hoja) actual.hojas.add(hoja);
    porEdificio.set(f.building_id, actual);
  }

  const todos = [...porEdificio.entries()].sort((a, b) =>
    a[1].nombre.localeCompare(b[1].nombre)
  );
  const pendientes = todos.filter(([, v]) => v.pendientes > 0);
  const revisados = todos.filter(([, v]) => v.pendientes === 0);

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/dashboard" className="text-sm text-gray-500">
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Edificios cargados desde las hojas</h1>
        <p className="mt-1 text-gray-600">
          Estos equipos los cargó el sistema leyendo las hojas de mantenimiento. Abrí el
          inventario, corregí lo que haga falta y marcá el edificio como revisado.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          {pendientes.length} por revisar · {revisados.length} ya revisados
        </p>
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Mientras un edificio esté sin revisar, el formulario del técnico sale
          <strong> completo</strong> (sin filtrar por sus equipos). Al marcarlo como
          revisado, el formulario empieza a mostrar solo lo que ese edificio tiene.
        </p>
      </div>

      <div className="space-y-2">
        {pendientes.map(([id, v]) => (
          <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
            <div>
              <div className="font-medium">{v.nombre}</div>
              <div className="text-sm text-gray-500">
                {v.total} equipos · hoja{v.hojas.size > 1 ? "s" : ""} Nº
                {[...v.hojas].join(", Nº")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/ops/buildings/${id}/equipment`}
                className="rounded border px-3 py-1 text-sm"
              >
                Ver inventario
              </Link>
              {!isReadOnly ? (
                <form action={marcarVerificado}>
                  <input type="hidden" name="building_id" value={id} />
                  <button type="submit" className="rounded bg-black px-3 py-1 text-sm text-white">
                    Ya lo revisé
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ))}
        {!pendientes.length ? (
          <p className="text-gray-500">No queda ningún edificio por revisar.</p>
        ) : null}
      </div>

      {revisados.length ? (
        <div className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Ya revisados</h2>
          <div className="space-y-1">
            {revisados.map(([id, v]) => (
              <div key={id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <span>
                  {v.nombre} <span className="text-gray-500">· {v.total} equipos</span>
                </span>
                <Link href={`/ops/buildings/${id}/equipment`} className="text-gray-500">
                  Ver inventario
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
