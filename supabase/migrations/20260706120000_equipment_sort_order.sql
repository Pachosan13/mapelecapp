-- Orden manual de equipos por edificio (feedback William SEMCO, 6-jul-2026).
-- Antes el inventario se mostraba alfabético por nombre y no había forma de
-- reordenar ni de borrar un equipo mal colocado.
alter table public.equipment
  add column if not exists sort_order integer;

-- Backfill: por edificio, respeta el orden alfabético ACTUAL (10,20,30…) para que
-- nada salte de lugar al desplegar. Los equipos nuevos entran al final (max+10).
with ranked as (
  select id,
         row_number() over (partition by building_id order by name) * 10 as so
  from public.equipment
)
update public.equipment e
set sort_order = r.so
from ranked r
where e.id = r.id
  and e.sort_order is null;
