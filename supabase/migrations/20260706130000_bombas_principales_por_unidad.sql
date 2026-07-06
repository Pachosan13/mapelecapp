-- Bombas principales POR UNIDAD — feedback William (SEMCO), ONIX TOWER (5-jul-2026).
-- Problema: el checklist mostraba UN solo bloque genérico de "Bombas principales" como si
-- hubiera una sola bomba, pero los edificios tienen varias (ONIX: 2 bombas principales).
--
-- Solución consistente con reforzadoras/sumergibles: las bombas principales pasan a estar
-- desglosadas POR UNIDAD en la plantilla ("Bomba 1/2/3"), cada una con su propio set de
-- template_items (mismo keying por item_id → NO cambia guardado ni PDF). El filtro por
-- edificio (app/tech/visits/[id]/page.tsx) muestra solo tantas unidades como bombas
-- (equipment.kind='bomba') tenga el sistema transferencia_agua_potable.
--
-- El set plano existente (16 campos, so 100..190) se RENOMBRA a "Bomba 1" y se RENUMERA a
-- 100..115 para dejar espacio contiguo (Bomba 2 → 120..135, Bomba 3 → 140..155), todo por
-- debajo de Tablero (so 200) para conservar el orden en la app y en el PDF. Renombrar
-- preserva el item_id, así que las respuestas históricas siguen apuntando a su campo.
--
-- Idempotente. NO ejecutar contra ninguna DB desde aquí (se aplica en prod aparte).

begin;

-- ── 1) Renombrar + renumerar el set plano existente → "Bomba 1" (100..115) ──
update public.template_items as ti
set label = 'Bombas principales - Bomba 1 - ' || v.field,
    sort_order = v.sort_order
from (values
  ('Voltaje L1-L2', 100), ('Voltaje L2-L3', 101), ('Voltaje L1-L3', 102),
  ('Amperaje L1-L2', 103), ('Amperaje L2-L3', 104), ('Amperaje L1-L3', 105),
  ('Potencia del motor (HP)', 106), ('Presión estática', 107), ('Presión dinámica', 108),
  ('Plomería en succión', 109), ('Plomería en descarga', 110), ('Plomería ok', 111),
  ('Check valve', 112), ('Tanque de reserva (sótano / nivel inferior)', 113),
  ('Tanque de presión', 114), ('Sensor de nivel', 115)
) as v(field, sort_order)
where ti.template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and ti.label = 'Bombas principales - ' || v.field;

-- ── 2) Insertar Bomba 2 (120..135) y Bomba 3 (140..155) ──
-- Mismos 16 campos + item_types que Bomba 1. Guardado por not-exists (idempotente).
insert into public.template_items (template_id, label, item_type, required, sort_order)
select t.id, v.label, v.item_type, false, v.sort_order
from (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%') t
cross join (values
  -- Bomba 2
  ('Bombas principales - Bomba 2 - Voltaje L1-L2', 'number', 120),
  ('Bombas principales - Bomba 2 - Voltaje L2-L3', 'number', 121),
  ('Bombas principales - Bomba 2 - Voltaje L1-L3', 'number', 122),
  ('Bombas principales - Bomba 2 - Amperaje L1-L2', 'number', 123),
  ('Bombas principales - Bomba 2 - Amperaje L2-L3', 'number', 124),
  ('Bombas principales - Bomba 2 - Amperaje L1-L3', 'number', 125),
  ('Bombas principales - Bomba 2 - Potencia del motor (HP)', 'number', 126),
  ('Bombas principales - Bomba 2 - Presión estática', 'number', 127),
  ('Bombas principales - Bomba 2 - Presión dinámica', 'number', 128),
  ('Bombas principales - Bomba 2 - Plomería en succión', 'text', 129),
  ('Bombas principales - Bomba 2 - Plomería en descarga', 'text', 130),
  ('Bombas principales - Bomba 2 - Plomería ok', 'checkbox', 131),
  ('Bombas principales - Bomba 2 - Check valve', 'checkbox', 132),
  ('Bombas principales - Bomba 2 - Tanque de reserva (sótano / nivel inferior)', 'checkbox', 133),
  ('Bombas principales - Bomba 2 - Tanque de presión', 'checkbox', 134),
  ('Bombas principales - Bomba 2 - Sensor de nivel', 'checkbox', 135),
  -- Bomba 3
  ('Bombas principales - Bomba 3 - Voltaje L1-L2', 'number', 140),
  ('Bombas principales - Bomba 3 - Voltaje L2-L3', 'number', 141),
  ('Bombas principales - Bomba 3 - Voltaje L1-L3', 'number', 142),
  ('Bombas principales - Bomba 3 - Amperaje L1-L2', 'number', 143),
  ('Bombas principales - Bomba 3 - Amperaje L2-L3', 'number', 144),
  ('Bombas principales - Bomba 3 - Amperaje L1-L3', 'number', 145),
  ('Bombas principales - Bomba 3 - Potencia del motor (HP)', 'number', 146),
  ('Bombas principales - Bomba 3 - Presión estática', 'number', 147),
  ('Bombas principales - Bomba 3 - Presión dinámica', 'number', 148),
  ('Bombas principales - Bomba 3 - Plomería en succión', 'text', 149),
  ('Bombas principales - Bomba 3 - Plomería en descarga', 'text', 150),
  ('Bombas principales - Bomba 3 - Plomería ok', 'checkbox', 151),
  ('Bombas principales - Bomba 3 - Check valve', 'checkbox', 152),
  ('Bombas principales - Bomba 3 - Tanque de reserva (sótano / nivel inferior)', 'checkbox', 153),
  ('Bombas principales - Bomba 3 - Tanque de presión', 'checkbox', 154),
  ('Bombas principales - Bomba 3 - Sensor de nivel', 'checkbox', 155)
) as v(label, item_type, sort_order)
where not exists (
  select 1 from public.template_items x where x.template_id = t.id and x.label = v.label
);

commit;
