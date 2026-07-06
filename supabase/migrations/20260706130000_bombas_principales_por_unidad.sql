-- Bombas principales POR UNIDAD -- feedback William (SEMCO), ONIX TOWER (5-jul-2026).
-- Problema: el checklist mostraba UN solo bloque generico de "Bombas principales" como si
-- hubiera una sola bomba, pero los edificios tienen varias (ONIX: 2 bombas principales).
--
-- Solucion consistente con reforzadoras/sumergibles: las bombas principales pasan a estar
-- desglosadas POR UNIDAD en la plantilla ("Bomba 1/2/3"), cada una con su propio set de
-- template_items (mismo keying por item_id -> NO cambia guardado ni PDF). El filtro por
-- edificio (app/tech/visits/[id]/page.tsx) muestra solo tantas unidades como bombas
-- (equipment.kind='bomba') tenga el sistema transferencia_agua_potable.
--
-- El set plano existente se RENOMBRA a "Bomba 1" (clonando por reemplazo de texto, sin
-- listar cada campo acentuado -> 100% ASCII, seguro de pegar en el SQL editor) y se
-- RENUMERA contiguo 100..115 para dejar espacio a Bomba 2 (120..135) y Bomba 3 (140..155),
-- todo por debajo de Tablero (so 200) para conservar el orden en la app y en el PDF.
-- Renombrar preserva el item_id, asi que las respuestas historicas siguen apuntando a su campo.
--
-- Idempotente. NO ejecutar contra ninguna DB desde aqui (se aplica en prod aparte).

begin;

-- 1) Renombrar el set plano existente -> "Bomba 1" (por reemplazo, sin listar campos).
update public.template_items
set label = replace(label, 'Bombas principales - ', 'Bombas principales - Bomba 1 - ')
where template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and label like 'Bombas principales - %'
  and label not like 'Bombas principales - Bomba %';

-- 2) Renumerar Bomba 1 contiguo 100..115 respetando su orden actual.
with r as (
  select id, (100 + row_number() over (order by sort_order) - 1) as so
  from public.template_items
  where template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
    and label like 'Bombas principales - Bomba 1 - %'
)
update public.template_items t set sort_order = r.so from r where t.id = r.id;

-- 3) Insertar Bomba 2 (so +20) y Bomba 3 (so +40) clonando Bomba 1. Idempotente por not-exists.
insert into public.template_items (template_id, label, item_type, required, sort_order)
select ti.template_id, replace(ti.label, 'Bomba 1 -', 'Bomba 2 -'), ti.item_type, ti.required, ti.sort_order + 20
from public.template_items ti
where ti.template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and ti.label like 'Bombas principales - Bomba 1 - %'
  and not exists (
    select 1 from public.template_items x
    where x.template_id = ti.template_id and x.label = replace(ti.label, 'Bomba 1 -', 'Bomba 2 -')
  );

insert into public.template_items (template_id, label, item_type, required, sort_order)
select ti.template_id, replace(ti.label, 'Bomba 1 -', 'Bomba 3 -'), ti.item_type, ti.required, ti.sort_order + 40
from public.template_items ti
where ti.template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and ti.label like 'Bombas principales - Bomba 1 - %'
  and not exists (
    select 1 from public.template_items x
    where x.template_id = ti.template_id and x.label = replace(ti.label, 'Bomba 1 -', 'Bomba 3 -')
  );

commit;
