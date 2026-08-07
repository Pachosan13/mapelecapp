/**
 * Trae TODAS las filas de una consulta, paginando.
 *
 * PostgREST corta en 1.000 filas por respuesta (`db-max-rows`) y lo hace **en silencio**:
 * no da error, no avisa, simplemente devuelve mil. Pedir un rango más grande no sirve —
 * el tope es duro. La única salida es pedir de mil en mil.
 *
 * Por qué existe esto (7-ago-2026): la plantilla "Mantenimiento – Bombas" pasó de 983 a
 * 1.211 ítems al agregar los 9 campos de bomba contra incendio y los tableros por unidad.
 * En cuanto cruzó los 1.000, las consultas que no paginaban perdieron las últimas 211
 * filas por `sort_order` — y ahí viven Bomba Jockey, Panel contra incendios, Panel jockey,
 * Planta de Emergencia y Entrega. El formulario del técnico y el PDF dejaron de mostrarlas
 * sin decir nada. El filtro estaba bien; lo que faltaba eran las filas.
 *
 * Se detectó comparando el filtro (que decía "esta sección aplica") contra el PDF de
 * producción (que no la traía). Cuando el diagnóstico y el render no coinciden, sospechar
 * de la capa de datos antes que de la lógica.
 *
 * Uso:
 *   const { data, error } = await fetchAllRows((desde, hasta) =>
 *     supabase.from("template_items").select("…").eq("template_id", id)
 *       .order("sort_order", { ascending: true }).range(desde, hasta)
 *   );
 */
const TAMANO_PAGINA = 1000;

export async function fetchAllRows<T>(
  consulta: (
    desde: number,
    hasta: number
  ) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<{ data: T[]; error: unknown }> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await consulta(desde, desde + TAMANO_PAGINA - 1);
    if (error) return { data: filas, error };
    const pagina = data ?? [];
    filas.push(...pagina);
    // Página incompleta = era la última. Evita una llamada de más en el caso normal.
    if (pagina.length < TAMANO_PAGINA) break;
  }
  return { data: filas, error: null };
}
