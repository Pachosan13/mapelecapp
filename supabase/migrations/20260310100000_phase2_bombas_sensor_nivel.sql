begin;

with bombas_templates as (
  select id
  from public.visit_templates
  where lower(name) like 'mantenimiento%bombas%'
),
new_items(template_id, label, item_type, required, sort_order) as (
  select bt.id, v.label, 'checkbox'::text, false, v.sort_order
  from bombas_templates bt
  cross join (
    values
      ('Bombas principales - Sensor de nivel', 190),
      ('Bomba reforzadora 1 - Sensor de nivel', 390),
      ('Bomba reforzadora 2 - Sensor de nivel', 490),
      ('Bomba reforzadora 3 - Sensor de nivel', 590)
  ) as v(label, sort_order)
)
insert into public.template_items (template_id, label, item_type, required, sort_order)
select ni.template_id, ni.label, ni.item_type, ni.required, ni.sort_order
from new_items ni
where not exists (
  select 1
  from public.template_items ti
  where ti.template_id = ni.template_id
    and ti.label = ni.label
);

commit;
