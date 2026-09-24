-- Convierte la sección "Planta de Emergencia" de única a por-unidad (1..4). Plantilla
-- "Mantenimiento – Bombas". Mismo patrón que la jockey (20260729120000).
--
-- Contexto (24-sep-2026, feedback William — PH AQUAPOINT): el edificio tiene dos plantas,
-- una para el área social y otra para apartamentos, y el formato solo mostraba una. El
-- filtro (lib/bombas/checklistFilter.ts) ya cuenta las plantas (scope.generatorCount) y
-- muestra "Planta de Emergencia N" hasta ese número. En prod hay 42 edificios con planta:
-- 40 con una y 2 con dos. Se siembran 4 unidades de margen.
--
-- De paso arregla los 3 labels mal formados ("Planta de Emergencia- Modelo", sin espacio
-- antes del guion) que `groupOf` mandaba a "Datos generales": al renumerar quedan dentro de
-- la sección de su planta.
--
-- Layout de sort_order (plantilla b474): la planta son 25 ítems en 16000000..16980000 y el
-- grupo siguiente ("Entrega") arranca en 17300000. Cada unidad ocupa un bloque de 80000
-- (paso 3000 × 25 = 75000): la unidad 4 termina en 16312000, holgado antes de Entrega.
--
-- Seguridad: renombrar la unidad 1 no toca respuestas (van por item_id). Aditiva para 2..4.
-- Idempotente. Código primero: el filtro nuevo trata el label viejo sin numerar como unidad 1;
-- el viejo mostraría la unidad 2 a cualquier edificio con una sola planta.

do $$
declare
  v_template uuid := 'b474fbb0-b51d-42b0-acb2-dae04f303f32';
  v_base int := 16000000;   -- inicio nativo de la sección planta; Entrega en 17300000
  v_step int := 3000;       -- separación entre ítems de una unidad
  v_stride int := 80000;    -- separación entre unidades
  n int;
begin
  -- 1) Renumera+re-empaca la sección existente como "Planta de Emergencia 1".
  if exists (
    select 1 from template_items
     where template_id = v_template and label ~ '^Planta de Emergencia ?- '
  ) then
    with ordered as (
      select id, (row_number() over (order by sort_order)) - 1 as idx
        from template_items
       where template_id = v_template
         and label ~ '^Planta de Emergencia ?- '
    )
    update template_items t
       set label = regexp_replace(t.label, '^Planta de Emergencia ?- ', 'Planta de Emergencia 1 - '),
           sort_order = v_base + o.idx * v_step
      from ordered o
     where t.id = o.id;
  end if;

  -- 2) Clona "Planta de Emergencia 1" hacia 2..4 (solo las que falten).
  for n in 2..4 loop
    insert into template_items (template_id, label, item_type, required, sort_order)
    select v_template,
           regexp_replace(ti.label, '^Planta de Emergencia 1 - ', 'Planta de Emergencia ' || n || ' - '),
           ti.item_type,
           ti.required,
           ti.sort_order + (n - 1) * v_stride
      from template_items ti
     where ti.template_id = v_template
       and ti.label like 'Planta de Emergencia 1 - %'
       and not exists (
         select 1 from template_items t2
          where t2.template_id = v_template
            and t2.label = regexp_replace(ti.label, '^Planta de Emergencia 1 - ', 'Planta de Emergencia ' || n || ' - ')
       );
  end loop;
end $$;
