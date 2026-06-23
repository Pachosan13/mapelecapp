-- 3ª ronda de correcciones de William (SEMCO) sobre el DELIVERABLE real — 22-jun-2026 (noche).
-- William generó el PDF de una visita real (GreenWood), lo marcó a mano + 8 notas de voz.
-- La precarga de GreenWood confirmó: 2 bombas principales (transferencia agua potable); el foso
-- elevador (achique_elevador) NO tiene panel de control (va directo a 110V, 1 solo sensor),
-- mientras pluvial/freático/sanitario SÍ tienen panel con contactor/térmica.
--
-- Decisión de Pacho: marcas/modelos/balineras = se autopueblan del LEVANTAMIENTO (NO campos de
-- visita); "Potencia del motor (HP)" SÍ va en el PDF de visita.
--
-- Aplicado en prod vía REST; este archivo lo registra (idempotente).

begin;

-- ── Renombrar ──
-- "Presión diferencial" -> "Presión dinámica" (William aclaró el término correcto en bombas principales)
update public.template_items
set label = 'Bombas principales - Presión dinámica'
where template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and label = 'Bombas principales - Presión diferencial';

-- Sumergibles: el 3er par debe ser L1-L3 (no L3-L1), consistente con el resto (Voltaje + Amperaje)
update public.template_items
set label = replace(label, 'L3-L1', 'L1-L3')
where template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and label like 'Bombas sumergibles%L3-L1%';

-- ── Agregar: Amperaje (L1-L2/L2-L3/L1-L3) + Potencia del motor (HP), solo en bombeo (principales + reforzadoras) ──
insert into public.template_items (template_id, label, item_type, required, sort_order)
select t.id, v.label, 'number', false, v.sort_order
from (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%') t
cross join (values
  ('Bombas principales - Amperaje L1-L2', 122), ('Bombas principales - Amperaje L2-L3', 124),
  ('Bombas principales - Amperaje L1-L3', 126), ('Bombas principales - Potencia del motor (HP)', 128),
  ('Bomba reforzadora 1 - Amperaje L1-L2', 322), ('Bomba reforzadora 1 - Amperaje L2-L3', 324),
  ('Bomba reforzadora 1 - Amperaje L1-L3', 326), ('Bomba reforzadora 1 - Potencia del motor (HP)', 328),
  ('Bomba reforzadora 2 - Amperaje L1-L2', 422), ('Bomba reforzadora 2 - Amperaje L2-L3', 424),
  ('Bomba reforzadora 2 - Amperaje L1-L3', 426), ('Bomba reforzadora 2 - Potencia del motor (HP)', 428),
  ('Bomba reforzadora 3 - Amperaje L1-L2', 522), ('Bomba reforzadora 3 - Amperaje L2-L3', 524),
  ('Bomba reforzadora 3 - Amperaje L1-L3', 526), ('Bomba reforzadora 3 - Potencia del motor (HP)', 528)
) as v(label, sort_order)
where not exists (
  select 1 from public.template_items x where x.template_id = t.id and x.label = v.label
);

-- ── Quitar ──
-- Check valve va en bombeo; Válvula de alivio va en contra incendio (estaban al revés):
delete from public.template_items
where template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and label in (
    'Bombas principales - Válvula de alivio',
    'Bomba reforzadora 1 - Válvula de alivio',
    'Bomba reforzadora 2 - Válvula de alivio',
    'Bomba reforzadora 3 - Válvula de alivio',
    'Bomba contra incendio - Check valve'
  );

-- Foso elevador: sin contactor/térmica/sensor de desborde/panel (no tiene panel; pluvial/sanitario SÍ los conservan):
delete from public.template_items
where template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and (
    label like 'Bombas sumergibles - Foso elevador - Bomba % - Contactor (A)'
    or label like 'Bombas sumergibles - Foso elevador - Bomba % - Térmica (A)'
    or label like 'Bombas sumergibles - Foso elevador - Bomba % - Pruebas sensor de desborde'
    or label like 'Bombas sumergibles - Foso elevador - Panel de control - %'
  );

-- Quitar las filas "No aplica" (toggle on/off por sistema; William las marcó NO VA):
delete from public.template_items
where template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and label like 'Bombas sumergibles%- No aplica';

commit;
