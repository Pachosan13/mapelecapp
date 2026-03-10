begin;

with bombas_templates as (
  select id
  from public.visit_templates
  where lower(name) like 'mantenimiento%bombas%'
)
update public.template_items ti
set sort_order = sort_order + 1000
where ti.template_id in (select id from bombas_templates)
  and ti.sort_order >= 600
  and not exists (
    select 1
    from public.template_items ti2
    where ti2.template_id = ti.template_id
      and ti2.label = 'Bombas sumergibles - Foso elevador - No aplica'
  );

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
      ('Bombas sumergibles - Foso elevador - No aplica', 600),
      ('Bombas sumergibles - Foso elevador - Bomba 1 - Línea 1 con línea 2', 601),
      ('Bombas sumergibles - Foso elevador - Bomba 1 - Línea 2 con línea 3', 602),
      ('Bombas sumergibles - Foso elevador - Bomba 1 - Línea 3 con línea 1', 603),
      ('Bombas sumergibles - Foso elevador - Bomba 1 - Voltaje', 604),
      ('Bombas sumergibles - Foso elevador - Bomba 1 - Amperaje', 605),
      ('Bombas sumergibles - Foso elevador - Bomba 1 - Jet valve', 606),
      ('Bombas sumergibles - Foso elevador - Bomba 1 - Contactor térmica 1', 607),
      ('Bombas sumergibles - Foso elevador - Bomba 1 - Contactor térmica 2', 608),
      ('Bombas sumergibles - Foso elevador - Bomba 2 - Línea 1 con línea 2', 609),
      ('Bombas sumergibles - Foso elevador - Bomba 2 - Línea 2 con línea 3', 610),
      ('Bombas sumergibles - Foso elevador - Bomba 2 - Línea 3 con línea 1', 611),
      ('Bombas sumergibles - Foso elevador - Bomba 2 - Voltaje', 612),
      ('Bombas sumergibles - Foso elevador - Bomba 2 - Amperaje', 613),
      ('Bombas sumergibles - Foso elevador - Bomba 2 - Jet valve', 614),
      ('Bombas sumergibles - Foso elevador - Bomba 2 - Contactor térmica 1', 615),
      ('Bombas sumergibles - Foso elevador - Bomba 2 - Contactor térmica 2', 616),

      ('Bombas sumergibles - Sistema pluvial - No aplica', 620),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 1 - Línea 1 con línea 2', 621),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 1 - Línea 2 con línea 3', 622),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 1 - Línea 3 con línea 1', 623),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 1 - Voltaje', 624),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 1 - Amperaje', 625),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 1 - Jet valve', 626),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 1 - Contactor térmica 1', 627),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 1 - Contactor térmica 2', 628),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 2 - Línea 1 con línea 2', 629),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 2 - Línea 2 con línea 3', 630),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 2 - Línea 3 con línea 1', 631),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 2 - Voltaje', 632),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 2 - Amperaje', 633),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 2 - Jet valve', 634),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 2 - Contactor térmica 1', 635),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 1 - Bomba 2 - Contactor térmica 2', 636),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 1 - Línea 1 con línea 2', 637),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 1 - Línea 2 con línea 3', 638),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 1 - Línea 3 con línea 1', 639),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 1 - Voltaje', 640),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 1 - Amperaje', 641),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 1 - Jet valve', 642),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 1 - Contactor térmica 1', 643),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 1 - Contactor térmica 2', 644),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 2 - Línea 1 con línea 2', 645),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 2 - Línea 2 con línea 3', 646),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 2 - Línea 3 con línea 1', 647),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 2 - Voltaje', 648),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 2 - Amperaje', 649),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 2 - Jet valve', 650),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 2 - Contactor térmica 1', 651),
      ('Bombas sumergibles - Sistema pluvial - Pluvial 2 - Bomba 2 - Contactor térmica 2', 652),

      ('Bombas sumergibles - Sistema sanitario - No aplica', 660),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 1 - Línea 1 con línea 2', 661),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 1 - Línea 2 con línea 3', 662),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 1 - Línea 3 con línea 1', 663),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 1 - Voltaje', 664),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 1 - Amperaje', 665),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 1 - Jet valve', 666),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 1 - Contactor térmica 1', 667),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 1 - Contactor térmica 2', 668),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 2 - Línea 1 con línea 2', 669),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 2 - Línea 2 con línea 3', 670),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 2 - Línea 3 con línea 1', 671),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 2 - Voltaje', 672),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 2 - Amperaje', 673),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 2 - Jet valve', 674),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 2 - Contactor térmica 1', 675),
      ('Bombas sumergibles - Sistema sanitario - Sanitario - Bomba 2 - Contactor térmica 2', 676)
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
