-- Convierte la sección "Bomba Jockey" de única a por-unidad (1, 2, 3). Plantilla
-- "Mantenimiento – Bombas". Mismo patrón que la bomba contra incendio normada.
--
-- Contexto (29-jul-2026, feedback William — PH. Colores de Bella Vista): el edificio tiene
-- bomba jockey en Sótano 4 Y en Azotea, y William confirmó que la de azotea lleva su propio
-- checklist. El filtro (lib/bombas/checklistFilter.ts) ya cuenta los jockeys del edificio
-- (scope.jockeyCount) y muestra "Bomba Jockey N" hasta ese número.
--
-- Layout de sort_order (plantilla b474): la sección jockey son 6 ítems en 1545..1570, y el
-- grupo siguiente ("Panel contra incendios") arranca en 1571. Re-empaco las 3 unidades en
-- 1545..1562 (18 ítems, paso 1), que cabe holgado antes de 1571 y NO depende de la migración
-- de la bomba de incendio (self-contained).
--
-- Seguridad: renombrar la unidad 1 no toca respuestas (van por item_id). Aditiva para 2 y 3.
-- Idempotente. El regex `^Bomba Jockey - ` no casa "Panel jockey" ni "Panel de control…".
-- Código primero: el filtro ya trata el label viejo sin numerar por presencia (hasJockey).

do $$
declare
  v_template uuid := 'b474fbb0-b51d-42b0-acb2-dae04f303f32';
  v_base int := 1545;   -- inicio nativo de la sección jockey; Panel contra incendios en 1571
  v_stride int := 6;    -- ítems por unidad de jockey
  n int;
begin
  -- 1) Renumera+re-empaca la sección existente como "Bomba Jockey 1" (1545..1550).
  if exists (
    select 1 from template_items
     where template_id = v_template and label like 'Bomba Jockey - %'
  ) then
    with ordered as (
      select id, (row_number() over (order by sort_order)) - 1 as idx
        from template_items
       where template_id = v_template
         and label like 'Bomba Jockey - %'
    )
    update template_items t
       set label = regexp_replace(t.label, '^Bomba Jockey - ', 'Bomba Jockey 1 - '),
           sort_order = v_base + o.idx
      from ordered o
     where t.id = o.id;
  end if;

  -- 2) Clona "Bomba Jockey 1" hacia 2 y 3 (solo las que falten).
  for n in 2..3 loop
    insert into template_items (template_id, label, item_type, required, sort_order)
    select v_template,
           regexp_replace(ti.label, '^Bomba Jockey 1 - ', 'Bomba Jockey ' || n || ' - '),
           ti.item_type,
           ti.required,
           ti.sort_order + (n - 1) * v_stride
      from template_items ti
     where ti.template_id = v_template
       and ti.label like 'Bomba Jockey 1 - %'
       and not exists (
         select 1 from template_items t2
          where t2.template_id = v_template
            and t2.label = regexp_replace(ti.label, '^Bomba Jockey 1 - ', 'Bomba Jockey ' || n || ' - ')
       );
  end loop;
end $$;
