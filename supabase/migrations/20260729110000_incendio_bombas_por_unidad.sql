-- Convierte la sección "Bomba contra incendio" (normada) de única a por-unidad (1, 2, 3),
-- igual que las reforzadoras. Plantilla "Mantenimiento – Bombas".
--
-- Contexto (29-jul-2026, feedback William — PH. Colores de Bella Vista): el edificio tiene
-- bomba contra incendio en Sótano 4 Y en Azotea, pero el formato solo traía UNA sección de
-- incendio (por presencia), así que la 2ª bomba no tenía dónde registrarse. El filtro
-- (lib/bombas/checklistFilter.ts) ya cuenta las bombas normadas del edificio (los jockeys no
-- cuentan) y muestra "Bomba contra incendio N" hasta ese número.
--
-- Layout de sort_order alrededor de la sección (plantilla b474):
--   Bomba contra incendio (no normada)  1450..1490
--   Bomba contra incendio               1500..1540   <- 13 ítems, se re-empaca a 1491..1503
--   Bomba Jockey                         1545..1570
-- La sección está encajonada, así que se re-empaca compacta (1491..1503) para dejar sitio
-- contiguo y en orden a las unidades 2 (1504..1516) y 3 (1517..1529) antes del Jockey (1545).
--
-- Seguridad:
--  * Renombrar la unidad 1 NO toca respuestas de campo: visit_responses referencia item_id,
--    no el label. Solo cambia el texto mostrado ("Bomba contra incendio" -> "... 1").
--  * Aditiva para 2 y 3 (INSERT). Idempotente (guards). No borra nada.
--  * El regex `^Bomba contra incendio - ` NO casa "(no normada)" ni "Panel contra incendios".
--  * Código primero: el filtro ya trata el label viejo sin numerar por presencia, así que
--    entre el deploy y esta migración no hay hueco de comportamiento.

do $$
declare
  v_template uuid := 'b474fbb0-b51d-42b0-acb2-dae04f303f32';
  v_base int := 1491;   -- primer slot libre tras "(no normada)" (…1490); Jockey en 1545
  v_stride int := 13;   -- ítems por unidad de bomba de incendio
  n int;
begin
  -- 1) Renumera+re-empaca la sección existente como "Bomba contra incendio 1" (1491..1503).
  --    Solo corre si aún existe el label viejo sin numerar -> idempotente.
  if exists (
    select 1 from template_items
     where template_id = v_template and label like 'Bomba contra incendio - %'
  ) then
    with ordered as (
      select id, (row_number() over (order by sort_order)) - 1 as idx
        from template_items
       where template_id = v_template
         and label like 'Bomba contra incendio - %'
    )
    update template_items t
       set label = regexp_replace(t.label, '^Bomba contra incendio - ', 'Bomba contra incendio 1 - '),
           sort_order = v_base + o.idx
      from ordered o
     where t.id = o.id;
  end if;

  -- 2) Clona "Bomba contra incendio 1" hacia 2 y 3 (solo las que falten).
  for n in 2..3 loop
    insert into template_items (template_id, label, item_type, required, sort_order)
    select v_template,
           regexp_replace(ti.label, '^Bomba contra incendio 1 - ', 'Bomba contra incendio ' || n || ' - '),
           ti.item_type,
           ti.required,
           ti.sort_order + (n - 1) * v_stride
      from template_items ti
     where ti.template_id = v_template
       and ti.label like 'Bomba contra incendio 1 - %'
       and not exists (
         select 1 from template_items t2
          where t2.template_id = v_template
            and t2.label = regexp_replace(ti.label, '^Bomba contra incendio 1 - ', 'Bomba contra incendio ' || n || ' - ')
       );
  end loop;
end $$;
