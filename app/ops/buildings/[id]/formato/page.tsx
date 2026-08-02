import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import {
  buildBuildingScope,
  equipoSinVerificar,
  groupOf,
  isBombasTemplate,
  isPresurizacionTemplate,
  itemAppliesToBuilding,
  EMPTY_SCOPE,
  type BuildingScope,
} from "@/lib/bombas/checklistFilter";

// Vista previa del formato que le va a salir al técnico en este edificio, SIN crear una
// visita de prueba.
//
// La pidió William (2-ago-2026): "¿cómo puedo probar que me sale el formato correcto en
// base a los equipos que voy creando, sin tener que asignarme una prueba a mi perfil de
// técnico? Ya que tendría que hacerlo con los 230 edificios para poder validar".
//
// ⚠️ Regla de esta pantalla: NO reimplementa el filtro. Corre exactamente la misma
// función (`buildBuildingScope` + `itemAppliesToBuilding`) y el mismo `select` de equipos
// (`is_active = true`) que usa el formulario del técnico en app/tech/visits/[id]/page.tsx.
// Si divergen, la vista previa miente — que es peor que no tenerla.

type SearchParams = { t?: string };

export default async function BuildingFormatoPage({
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
  const db = supabase.schema("public");

  const { data: building } = await db
    .from("buildings")
    .select("id,name")
    .eq("id", params.id)
    .maybeSingle();
  if (!building) {
    notFound();
  }

  // Mismo select que el técnico: solo equipos activos.
  const { data: equipmentRows } = await db
    .from("equipment")
    .select("name,system,kind,specs,is_active")
    .eq("building_id", params.id)
    .eq("is_active", true);
  const equipos = equipmentRows ?? [];

  const sinVerificar = equipos.filter(equipoSinVerificar).length;
  const scope: BuildingScope = buildBuildingScope(equipos);

  // Solo estas dos plantillas se filtran por inventario (decisión 15-jul). Las demás
  // salen completas siempre, así que no tiene sentido "previsualizarlas".
  const { data: templatesData } = await db
    .from("visit_templates")
    .select("id,name,category")
    .order("name", { ascending: true });
  const plantillas = (templatesData ?? []).filter(
    (t) =>
      isBombasTemplate(t.name, t.category) || isPresurizacionTemplate(t.name)
  );

  const activa =
    plantillas.find((t) => t.id === searchParams?.t) ?? plantillas[0] ?? null;

  const { data: itemsData } = activa
    ? await db
        .from("template_items")
        .select("id,label,sort_order")
        .eq("template_id", activa.id)
        .order("sort_order", { ascending: true })
    : { data: [] as { id: string; label: string | null }[] };
  const items = itemsData ?? [];

  // Misma condición que el técnico: sin sistemas en el scope no se filtra nada.
  const seFiltra = scope.systems.size > 0;
  const sale = (label: string) =>
    !seFiltra || itemAppliesToBuilding(label, scope);

  const grupos = new Map<string, { sale: number; oculto: number }>();
  for (const it of items) {
    const label = String(it.label ?? "");
    const g = groupOf(label);
    const acc = grupos.get(g) ?? { sale: 0, oculto: 0 };
    if (sale(label)) acc.sale += 1;
    else acc.oculto += 1;
    grupos.set(g, acc);
  }
  const totalSale = items.filter((i) => sale(String(i.label ?? ""))).length;

  return (
    <div className="min-h-screen p-6 sm:p-8">
      <Link
        href={`/ops/buildings/${building.id}/equipment`}
        className="text-sm text-gray-500"
      >
        ← Volver al inventario
      </Link>

      <h1 className="mt-2 text-2xl font-bold">{building.name}</h1>
      <p className="text-gray-600">
        Vista previa del formato — lo que le va a salir al técnico
      </p>

      {/* El aviso que evita el falso "está roto": mientras haya equipo sin verificar,
          o el edificio no tenga inventario, el formulario sale COMPLETO a propósito. */}
      {!seFiltra ? (
        <div className="mt-5 rounded border-l-4 border-amber-500 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">
            Este edificio todavía sale con el formato completo.
          </p>
          <p className="mt-1 text-amber-800">
            {sinVerificar > 0 ? (
              <>
                Tiene <strong>{sinVerificar}</strong> equipo(s) que entraron por
                lectura automática de las hojas y que nadie ha revisado. Mientras
                eso pase, el formulario NO se recorta — es a propósito: si la
                lectura se comió una bomba, el técnico perdería esa sección en
                campo.{" "}
                <Link href="/ops/verificacion" className="underline">
                  Revisar y marcar como verificado →
                </Link>
              </>
            ) : (
              <>
                No tiene equipos cargados, así que no hay contra qué recortar.
                Cargue el inventario y el formato se ajusta solo.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded border-l-4 border-green-600 bg-green-50 p-4 text-sm">
          <p className="font-semibold text-green-900">
            Formato recortado según los {equipos.length} equipos del inventario.
          </p>
          <p className="mt-1 text-green-800">
            Sistemas detectados: {[...scope.systems].join(", ") || "—"}
          </p>
        </div>
      )}

      {plantillas.length > 1 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {plantillas.map((t) => (
            <Link
              key={t.id}
              href={`/ops/buildings/${building.id}/formato?t=${t.id}`}
              className={`rounded border px-3 py-1.5 text-sm ${
                activa?.id === t.id
                  ? "border-black bg-black text-white"
                  : "border-gray-300 text-gray-700"
              }`}
            >
              {t.name}
            </Link>
          ))}
        </div>
      ) : null}

      {!activa ? (
        <p className="mt-6 text-sm text-gray-500">
          No hay plantillas que se filtren por inventario.
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-gray-600">
            <strong>{totalSale}</strong> de {items.length} campos de{" "}
            <em>{activa.name}</em>
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3">Sección</th>
                  <th className="w-20 py-2 pr-3 text-center">Le sale</th>
                  <th className="w-20 py-2 text-center">Oculto</th>
                </tr>
              </thead>
              <tbody>
                {[...grupos.entries()].map(([g, c]) => (
                  <tr
                    key={g}
                    className={`border-b border-gray-100 ${
                      c.sale === 0 ? "text-gray-400" : ""
                    }`}
                  >
                    <td className="py-2 pr-3">
                      {c.sale > 0 ? "✅ " : "🚫 "}
                      {g}
                    </td>
                    <td className="py-2 pr-3 text-center tabular-nums">
                      {c.sale || "—"}
                    </td>
                    <td className="py-2 text-center tabular-nums text-gray-400">
                      {c.oculto || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-semibold">
              Ver los {totalSale} campos, uno por uno
            </summary>
            <ol className="mt-3 list-decimal space-y-1 pl-6 text-sm text-gray-700">
              {items
                .filter((i) => sale(String(i.label ?? "")))
                .map((i) => (
                  <li key={i.id}>{i.label}</li>
                ))}
            </ol>
          </details>
        </>
      )}
    </div>
  );
}
