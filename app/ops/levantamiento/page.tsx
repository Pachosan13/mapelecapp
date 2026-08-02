import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { hojaAEquipos, type HojaLeida } from "@/lib/levantamiento/hojaAEquipos";

// Bandeja de hojas de mantenimiento que la lectura automática NO pudo asignar a un
// edificio: el nombre manuscrito matchea con dos ("Santa maria Village" -> FASE 1 o
// FASE 2), el edificio no está en la app, o la hoja usa un código interno del
// técnico ("S.M.B.P." = P.H PRIVAL). Son ~111 nombres distintos: demasiados para
// resolverlos de a uno por WhatsApp, y por eso viven en una sola pantalla.
//
// Asignar escribe los equipos de esa hoja en el edificio elegido, con las mismas
// reglas que usó la carga masiva (lib/levantamiento/hojaAEquipos.ts).

function volverConError(mensaje: string): never {
  redirect(`/ops/levantamiento?error=${encodeURIComponent(mensaje)}`);
}

async function asignarHoja(formData: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user || user.role === "director") {
    redirect("/ops/levantamiento");
  }
  const hojaId = String(formData.get("hoja_id") ?? "");
  const buildingId = String(formData.get("building_id") ?? "");
  if (!buildingId) {
    volverConError("Elegí un edificio antes de asignar.");
  }
  await cargarHojaEnEdificio(hojaId, buildingId, user.id);
}

// La hoja trae un edificio que NO está en la app. Pasa seguido: la base tiene ~238 y
// SEMCO da servicio a ~300 (William, 2-ago: "el edificio no estaba creado, lo tuve que
// realizar manual ya que no salía en la lista"). Antes había que salir a /ops/buildings/new,
// crearlo y volver a buscar la hoja; ahora se crea y se asigna en un solo paso.
async function crearEdificioYAsignar(formData: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user || user.role === "director") {
    redirect("/ops/levantamiento");
  }
  const hojaId = String(formData.get("hoja_id") ?? "");
  const nombre = String(formData.get("nuevo_nombre") ?? "").trim();
  if (!nombre) {
    volverConError("Escribí el nombre del edificio nuevo.");
  }

  const db = (await createClient()).schema("public");
  // Si ya existe con ese nombre, no se duplica: se usa el que hay.
  const { data: existente } = await db
    .from("buildings")
    .select("id")
    .ilike("name", nombre)
    .maybeSingle();

  let buildingId = existente?.id ?? "";
  if (!buildingId) {
    const { data: creado, error: errCrear } = await db
      .from("buildings")
      .insert({ name: nombre, created_by: user.id })
      .select("id")
      .maybeSingle();
    if (errCrear || !creado) {
      volverConError(`No pude crear el edificio: ${errCrear?.message ?? "sin id"}`);
    }
    buildingId = creado.id;
  }

  await cargarHojaEnEdificio(hojaId, buildingId, user.id);
}

// Núcleo compartido por las dos acciones: valida la hoja, carga sus equipos y la marca
// resuelta. Vive aparte para que "crear y asignar" no reimplemente las reglas de carga.
async function cargarHojaEnEdificio(
  hojaId: string,
  buildingId: string,
  userId: string
) {
  const db = (await createClient()).schema("public");
  const { data: hoja } = await db
    .from("levantamiento_hojas")
    .select("id,payload,numero_reporte,estado")
    .eq("id", hojaId)
    .maybeSingle();
  if (!hoja) volverConError("No encontré esa hoja.");
  if (hoja.estado !== "pendiente") {
    volverConError(`La hoja Nº${hoja.numero_reporte} ya estaba resuelta.`);
  }

  // Nunca cargar encima de un edificio que ya tiene inventario: duplicaría los
  // equipos y la tabla tiene único (building_id, name), así que además fallaría a
  // media escritura. Si ya tiene, se revisa a mano.
  const { data: yaTiene } = await db
    .from("equipment")
    .select("id")
    .eq("building_id", buildingId)
    .limit(1);
  if (yaTiene?.length) {
    volverConError(
      "Ese edificio ya tiene equipos cargados. Revisalo primero desde su inventario; no cargo encima."
    );
  }

  const equipos = hojaAEquipos(hoja.payload as HojaLeida, buildingId);
  if (!equipos.length) {
    volverConError(`La hoja Nº${hoja.numero_reporte} no trae ningún equipo con datos.`);
  }

  const { error: errEquipos } = await db.from("equipment").insert(equipos);
  if (errEquipos) volverConError(`No pude cargar los equipos: ${errEquipos.message}`);

  await db
    .from("levantamiento_hojas")
    .update({
      building_id: buildingId,
      estado: "asignada",
      resuelta_por: userId,
      resuelta_at: new Date().toISOString(),
    })
    .eq("id", hojaId);

  revalidatePath("/ops/levantamiento");
  revalidatePath(`/ops/buildings/${buildingId}/equipment`);
}

async function descartarHoja(formData: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user || user.role === "director") {
    redirect("/ops/levantamiento");
  }
  const db = (await createClient()).schema("public");
  await db
    .from("levantamiento_hojas")
    .update({
      estado: "descartada",
      nota: String(formData.get("nota") ?? "") || null,
      resuelta_por: user.id,
      resuelta_at: new Date().toISOString(),
    })
    .eq("id", String(formData.get("hoja_id") ?? ""));
  revalidatePath("/ops/levantamiento");
}

export default async function LevantamientoPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isReadOnly = user.role === "director";

  const db = (await createClient()).schema("public");
  const [{ data: hojas }, { data: buildings }, { count: asignadas }] = await Promise.all([
    db
      .from("levantamiento_hojas")
      .select("id,archivo,numero_reporte,cliente_texto,fecha_hoja,tecnico,payload,candidatos")
      .eq("estado", "pendiente")
      .order("cliente_texto", { ascending: true }),
    db.from("buildings").select("id,name").order("name", { ascending: true }),
    db
      .from("levantamiento_hojas")
      .select("id", { count: "exact", head: true })
      .eq("estado", "asignada"),
  ]);

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6">
        <Link href="/ops/dashboard" className="text-sm text-gray-500">
          ← Volver
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Hojas por identificar</h1>
        <p className="mt-1 text-gray-600">
          Hojas de mantenimiento que no pude asignar a un edificio. Elegí cuál es y se cargan
          sus equipos; si el edificio no existe en la app todavía, descartala y creámoslo
          primero.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          {hojas?.length ?? 0} pendientes · {asignadas ?? 0} ya resueltas
        </p>
      </div>

      {searchParams?.error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {decodeURIComponent(searchParams.error)}
        </div>
      ) : null}

      <div className="space-y-3">
        {hojas?.length ? (
          hojas.map((h) => {
            const equipos = hojaAEquipos(h.payload as HojaLeida, "x");
            const candidatos = (h.candidatos as string[]) ?? [];
            return (
              <div key={h.id} className="rounded border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-lg font-semibold">
                    {h.cliente_texto || "(sin nombre legible)"}
                  </div>
                  <div className="text-sm text-gray-500">
                    Hoja Nº{h.numero_reporte} · {h.fecha_hoja} · {h.tecnico}
                  </div>
                </div>

                <p className="mt-1 text-sm text-gray-600">
                  Trae {equipos.length} equipos:{" "}
                  {equipos.map((e) => e.name).join(", ") || "ninguno"}
                </p>

                {candidatos.length ? (
                  <p className="mt-1 text-sm text-gray-500">
                    Se parece a: <span className="font-medium">{candidatos.join(" · ")}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">
                    No se parece a ningún edificio de la app.
                  </p>
                )}

                {!isReadOnly ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form action={asignarHoja} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="hoja_id" value={h.id} />
                      <select
                        name="building_id"
                        defaultValue=""
                        className="rounded border px-2 py-1 text-sm"
                      >
                        <option value="">Elegir edificio…</option>
                        {buildings?.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="rounded bg-black px-3 py-1 text-sm text-white">
                        Asignar y cargar
                      </button>
                    </form>
                    {/* El edificio no existe en la app: se crea y se asigna de una. */}
                    <form
                      action={crearEdificioYAsignar}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="hoja_id" value={h.id} />
                      <input
                        type="text"
                        name="nuevo_nombre"
                        placeholder="…o edificio nuevo"
                        defaultValue={h.cliente_texto ?? ""}
                        className="rounded border px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded border border-black px-3 py-1 text-sm text-black"
                      >
                        Crear y cargar
                      </button>
                    </form>
                    <form action={descartarHoja}>
                      <input type="hidden" name="hoja_id" value={h.id} />
                      <button type="submit" className="rounded border px-3 py-1 text-sm text-gray-600">
                        Descartar
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="text-gray-500">No queda ninguna hoja pendiente.</p>
        )}
      </div>
    </div>
  );
}
