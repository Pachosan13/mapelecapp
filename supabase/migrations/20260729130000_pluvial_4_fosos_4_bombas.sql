-- Extiende el pluvial a 4 fosos × 4 bombas por foso. Plantilla "Mantenimiento – Bombas".
--
-- Contexto (29-jul-2026, feedback William): cada foso pluvial tiene su panel y controla 2-3
-- bombas (4 muy raro). El template solo traía 2 fosos × 2 bombas, así que Prival (3 fosos) y
-- cualquier foso de 3-4 bombas no cabían. El filtro (lib/bombas/checklistFilter.ts, A1) ya
-- deriva el nº de fosos del nº de paneles pluviales y, en edificios de 1 foso, recorta a las
-- bombas reales; sembrar 4×4 cubre el caso raro sin perder datos (mostrar de más se ignora).
--
-- Layout: el pluvial está encajonado entre "Foso elevador" (…661) y "Sistema sanitario"
-- (901…). Se re-acomodan los 4 fosos DENTRO de 701..900 (50 slots por foso: 4 bombas ×11 +
-- Estado del foso + 5 de Panel de control = 50), en orden, sin tocar ningún otro subtipo.
--   Pluvial 1: 701..750 · Pluvial 2: 751..800 · Pluvial 3: 801..850 · Pluvial 4: 851..900
--
-- Seguridad:
--  * CERO DELETE → cero cascada a visit_responses (las respuestas van por item_id).
--  * A los ítems existentes (Pluvial 1/2: Bomba 1/2, Estado, Panel) solo se les cambia el
--    sort_order (UPDATE por label) — su id se conserva, así que las respuestas siguen atadas.
--  * Lo nuevo (Bombas 3/4 en todos los fosos + fosos 3/4 completos) entra por INSERT.
--  * Idempotente: el UPDATE re-asigna el mismo valor y el INSERT salta lo que ya existe.
--  * Pluvial 1 y 2 tienen estructura idéntica (verificado), así que el re-acomodo por label
--    no deja huérfanos. La estructura canónica se deriva de Pluvial 1 (no se hardcodea).

drop table if exists _pluvial_targets;

create temporary table _pluvial_targets as
with bomba_tpl as (
  -- Los 11 campos de una bomba, tomados de "Pluvial 1 - Bomba 1", en su orden.
  select regexp_replace(label, '^Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 1 - ', '') as fld,
         item_type, required,
         (row_number() over (order by sort_order)) - 1 as fidx
  from template_items
  where template_id = 'b474fbb0-b51d-42b0-acb2-dae04f303f32'
    and label like 'Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 1 - %'
),
foso_tpl as (
  -- Los ítems a nivel foso (Estado del foso + Panel de control), en su orden.
  select regexp_replace(label, '^Bombas sumergibles - Sistema pluvial - Pluvial 1 - ', '') as tail,
         item_type, required,
         (row_number() over (order by sort_order)) - 1 as lidx
  from template_items
  where template_id = 'b474fbb0-b51d-42b0-acb2-dae04f303f32'
    and label like 'Bombas sumergibles - Sistema pluvial - Pluvial 1 - %'
    and label not like 'Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba % - %'
)
select 'Bombas sumergibles - Sistema pluvial - Pluvial ' || f || ' - Bomba ' || b || ' - ' || bt.fld as label,
       bt.item_type, bt.required,
       701 + (f - 1) * 50 + (b - 1) * 11 + bt.fidx as sort_order
from generate_series(1, 4) as f
     cross join generate_series(1, 4) as b
     cross join bomba_tpl bt
union all
select 'Bombas sumergibles - Sistema pluvial - Pluvial ' || f || ' - ' || ft.tail as label,
       ft.item_type, ft.required,
       701 + (f - 1) * 50 + 44 + ft.lidx as sort_order
from generate_series(1, 4) as f
     cross join foso_tpl ft;

-- 1) Re-acomoda los ítems pluviales que ya existen (solo cambia sort_order).
update template_items t
   set sort_order = g.sort_order
  from _pluvial_targets g
 where t.template_id = 'b474fbb0-b51d-42b0-acb2-dae04f303f32'
   and t.label = g.label;

-- 2) Inserta lo que falta (Bombas 3/4 en cada foso + fosos 3 y 4 completos).
insert into template_items (template_id, label, item_type, required, sort_order)
select 'b474fbb0-b51d-42b0-acb2-dae04f303f32', g.label, g.item_type, g.required, g.sort_order
  from _pluvial_targets g
 where not exists (
   select 1 from template_items t
    where t.template_id = 'b474fbb0-b51d-42b0-acb2-dae04f303f32'
      and t.label = g.label
 );

drop table if exists _pluvial_targets;
