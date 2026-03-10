begin;

with bombas_templates as (
  select id
  from public.visit_templates
  where lower(name) like 'mantenimiento%bombas%'
)
update public.template_items ti
set
  label = case
    when ti.label ilike 'Bombas principales - Presion arranque'
      then 'Bombas principales - Presión estática'
    when ti.label ilike 'Bombas principales - Presion parada'
      then 'Bombas principales - Presión constante'
    when ti.label ilike 'Bombas principales - Presion succion'
      then 'Bombas principales - Valvulería en succión'
    when ti.label ilike 'Bombas principales - Presion descarga'
      then 'Bombas principales - Valvulería en descarga'
    when ti.label ilike 'Bomba reforzadora 1 - Presion succion'
      then 'Bomba reforzadora 1 - Valvulería en succión'
    when ti.label ilike 'Bomba reforzadora 1 - Presion descarga'
      then 'Bomba reforzadora 1 - Valvulería en descarga'
    when ti.label ilike 'Bomba reforzadora 2 - Presion succion'
      then 'Bomba reforzadora 2 - Valvulería en succión'
    when ti.label ilike 'Bomba reforzadora 2 - Presion descarga'
      then 'Bomba reforzadora 2 - Valvulería en descarga'
    when ti.label ilike 'Bomba reforzadora 3 - Presion succion'
      then 'Bomba reforzadora 3 - Valvulería en succión'
    when ti.label ilike 'Bomba reforzadora 3 - Presion descarga'
      then 'Bomba reforzadora 3 - Valvulería en descarga'
    when lower(trim(ti.label)) in ('succion', 'succión')
      then 'Valvulería en succión'
    when lower(trim(ti.label)) = 'descarga'
      then 'Valvulería en descarga'
    else ti.label
  end,
  item_type = case
    when ti.label ilike 'Bombas principales - Presion succion'
      or ti.label ilike 'Bombas principales - Presion descarga'
      or ti.label ilike 'Bomba reforzadora 1 - Presion succion'
      or ti.label ilike 'Bomba reforzadora 1 - Presion descarga'
      or ti.label ilike 'Bomba reforzadora 2 - Presion succion'
      or ti.label ilike 'Bomba reforzadora 2 - Presion descarga'
      or ti.label ilike 'Bomba reforzadora 3 - Presion succion'
      or ti.label ilike 'Bomba reforzadora 3 - Presion descarga'
      or lower(trim(ti.label)) in ('succion', 'succión', 'descarga')
      then 'text'
    else ti.item_type
  end
where ti.template_id in (select id from bombas_templates)
  and (
    ti.label ilike 'Bombas principales - Presion arranque'
    or ti.label ilike 'Bombas principales - Presion parada'
    or ti.label ilike 'Bombas principales - Presion succion'
    or ti.label ilike 'Bombas principales - Presion descarga'
    or ti.label ilike 'Bomba reforzadora 1 - Presion succion'
    or ti.label ilike 'Bomba reforzadora 1 - Presion descarga'
    or ti.label ilike 'Bomba reforzadora 2 - Presion succion'
    or ti.label ilike 'Bomba reforzadora 2 - Presion descarga'
    or ti.label ilike 'Bomba reforzadora 3 - Presion succion'
    or ti.label ilike 'Bomba reforzadora 3 - Presion descarga'
    or lower(trim(ti.label)) in ('succion', 'succión', 'descarga')
  );

commit;
