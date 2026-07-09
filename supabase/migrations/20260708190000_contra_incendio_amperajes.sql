-- ============================================
-- MAPELEC - Bomba contra incendio: agregar Amperajes (feedback William 8-jul-2026)
-- ============================================
-- William (WA 18:21): "en el formato de bomba contra incendio quedo pendiente
-- agregar los amperajes. Solo aparecen los voltajes L1 L2 L3, faltan los
-- Amperajes L1 L2 L3".
-- El form ya tenia Voltaje L1-L2/L2-L3/L1-L3 (sort 1500/1505/1510) pero cero
-- amperajes. Se agregan 3 items number pareados JUSTO debajo de los voltajes
-- (1511/1512/1513, antes de Presion de arranque en 1515), siguiendo el mismo
-- orden L1-L2 / L2-L3 / L1-L3 de los voltajes de este mismo form y la
-- convencion SIN sufijo de unidad de las reforzadoras.
-- Cambio ADITIVO (solo INSERT de items) - no toca ninguna respuesta existente.
-- Idempotente: WHERE NOT EXISTS por label.

insert into public.template_items (template_id, label, item_type, required, sort_order)
select t.template_id, v.label, 'number', false, v.sort_order
from (values
  ('Bomba contra incendio - Amperaje L1-L2', 1511),
  ('Bomba contra incendio - Amperaje L2-L3', 1512),
  ('Bomba contra incendio - Amperaje L1-L3', 1513)
) as v(label, sort_order)
cross join (
  select distinct template_id
  from public.template_items
  where label = 'Bomba contra incendio - Voltaje L1-L2'
) as t
where not exists (
  select 1 from public.template_items ti
  where ti.template_id = t.template_id
    and ti.label = v.label
);

-- Verify: debe dar 6 (3 voltajes + 3 amperajes) por template de contra incendio
-- select label, sort_order from public.template_items
--   where label like 'Bomba contra incendio - %aje L%' order by sort_order;
