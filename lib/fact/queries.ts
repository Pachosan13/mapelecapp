import { createAdminClient } from "@/lib/supabase/admin";
import { getPanamaDayRange } from "@/lib/dates/panama";
import { fetchAllRows } from "@/lib/db/fetchAllRows";
import { panamaDateOf } from "@/lib/reports/fecha";
import { nombreArchivoInforme } from "@/lib/reports/nombreArchivo";
import type { FilaFacturable } from "@/lib/fact/agrupar";

type VisitaRow = {
  id: string;
  completed_at: string | null;
  building_id: string | null;
  assigned_tech_user_id: string | null;
  building: { id: string; name: string } | null;
  template: { id: string; name: string } | null;
  crew: { name: string } | null;
};

/**
 * Visitas COMPLETADAS cuyo cierre cae entre `desde` y `hasta` (días de Panamá, ambos
 * incluidos).
 *
 * SOLO LECTURA y solo server. Usa el cliente de administración porque el rol `facturacion`
 * no tiene políticas de lectura sobre `visits`; a cambio, esta consulta es fija: únicamente
 * `status = completed`, sin parámetros que lleguen a la base salvo dos fechas ya validadas.
 * La página que la llama debe haber pasado por `requireRole` antes.
 *
 * Pagina de mil en mil (`fetchAllRows`): PostgREST corta en 1.000 filas sin avisar.
 */
export async function listarCompletados(
  desde: string,
  hasta: string
): Promise<{ filas: FilaFacturable[]; error: string | null }> {
  const inicio = getPanamaDayRange(desde);
  const fin = getPanamaDayRange(hasta);
  if (!inicio || !fin) return { filas: [], error: "Rango de fechas inválido." };

  const admin = createAdminClient();

  const { data, error } = await fetchAllRows<VisitaRow>((a, b) =>
    admin
      .from("visits")
      .select(
        "id,completed_at,building_id,assigned_tech_user_id,building:buildings(id,name),template:visit_templates(id,name),crew:crews(name)"
      )
      .eq("status", "completed")
      .gte("completed_at", inicio.start)
      .lt("completed_at", fin.end)
      // id como desempate: sin un orden estable, dos páginas podrían repetir o saltarse filas
      .order("completed_at", { ascending: false })
      .order("id", { ascending: true })
      .range(a, b) as unknown as PromiseLike<{ data: VisitaRow[] | null; error: unknown }>
  );
  if (error) {
    return { filas: [], error: "No se pudieron cargar los mantenimientos." };
  }

  const tecnicoIds = Array.from(
    new Set(data.map((v) => v.assigned_tech_user_id).filter((x): x is string => Boolean(x)))
  );
  const nombrePorUsuario = new Map<string, string>();
  if (tecnicoIds.length > 0) {
    const { data: perfiles } = await admin
      .from("profiles")
      .select("user_id,full_name")
      .in("user_id", tecnicoIds);
    (perfiles ?? []).forEach((p) => {
      if (p.full_name) nombrePorUsuario.set(p.user_id, p.full_name);
    });
  }

  const filas: FilaFacturable[] = [];
  for (const v of data) {
    if (!v.completed_at || !v.building_id) continue;
    const edificio = v.building?.name ?? "Edificio sin nombre";
    const formulario = v.template?.name ?? "Formulario";
    const dia = panamaDateOf(v.completed_at);
    filas.push({
      id: v.id,
      completedAt: v.completed_at,
      dia,
      edificioId: v.building_id,
      edificio,
      formulario,
      responsable:
        (v.assigned_tech_user_id && nombrePorUsuario.get(v.assigned_tech_user_id)) ||
        v.crew?.name ||
        null,
      archivo: nombreArchivoInforme(dia, edificio, [formulario]),
    });
  }
  return { filas, error: null };
}
