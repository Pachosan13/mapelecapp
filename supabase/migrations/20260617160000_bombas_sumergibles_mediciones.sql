-- Rediseño de la sección "Bombas sumergibles" del template de Bombas (SEMCO/William, 17-jun-2026).
--
-- Motivo: en sumergibles los parámetros eléctricos eran checkbox (Aprobado/Falla/N/A),
-- así que el técnico no podía escribir los valores medidos y los anotaba en papel.
-- William pidió (notas de voz + fotos 17-jun) casillas de NÚMERO para voltaje/amperaje/
-- contactor/térmica, más ítems de estado (sensores, check valve, estado del foso) y un
-- panel de control con opciones generales por sistema.
--
-- Estructura nueva POR BOMBA:
--   Voltaje L1-L2/L2-L3/L3-L1 (V) · Amperaje L1-L2/L2-L3/L3-L1 (A) · Contactor (A) ·
--   Térmica (A)  -> number
--   Check valve · Pruebas sensor de nivel · Pruebas sensor de desborde -> checkbox (Aprob/Falla/N/A)
-- POR SISTEMA (compartido):
--   Estado del foso (Aprobado/Requiere limpieza) · Panel de control: Luces piloto,
--   Supervisor de voltaje, Relay alternador, Mini breaker, Selector de posición -> checkbox
--
-- La unidad va dentro del label "(V)"/"(A)" para que se muestre en el formulario y en el PDF
-- sin tocar el esquema. Reconstrucción limpia (delete + insert) — idempotente.

begin;

with tmpl as (
  select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%'
)
delete from public.template_items
where template_id in (select id from tmpl)
  and label like 'Bombas sumergibles%';

with tmpl as (
  select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%'
),
-- pump-sets: prefijo + base de sort_order (100 de separación, sobra espacio)
psets(prefix, base) as (
  values
    ('Bombas sumergibles - Foso elevador', 600),
    ('Bombas sumergibles - Sistema pluvial - Pluvial 1', 700),
    ('Bombas sumergibles - Sistema pluvial - Pluvial 2', 800),
    ('Bombas sumergibles - Sistema sanitario - Sanitario', 900)
),
-- ítems individuales por bomba
pump_items(suffix, itype, iorder) as (
  values
    ('Voltaje L1-L2 (V)', 'number', 1),
    ('Voltaje L2-L3 (V)', 'number', 2),
    ('Voltaje L3-L1 (V)', 'number', 3),
    ('Amperaje L1-L2 (A)', 'number', 4),
    ('Amperaje L2-L3 (A)', 'number', 5),
    ('Amperaje L3-L1 (A)', 'number', 6),
    ('Contactor (A)', 'number', 7),
    ('Térmica (A)', 'number', 8),
    ('Check valve', 'checkbox', 9),
    ('Pruebas sensor de nivel', 'checkbox', 10),
    ('Pruebas sensor de desborde', 'checkbox', 11)
),
-- ítems compartidos por sistema (estado del foso + panel de control general)
set_items(suffix, itype, iorder) as (
  values
    ('Estado del foso', 'checkbox', 1),
    ('Panel de control - Luces piloto', 'checkbox', 2),
    ('Panel de control - Supervisor de voltaje', 'checkbox', 3),
    ('Panel de control - Relay alternador', 'checkbox', 4),
    ('Panel de control - Mini breaker', 'checkbox', 5),
    ('Panel de control - Selector de posición', 'checkbox', 6)
),
bombas(n) as ( values (1), (2) ),
gen as (
  -- por bomba
  select
    p.prefix || ' - Bomba ' || b.n || ' - ' || pi.suffix as label,
    pi.itype as item_type,
    p.base + (b.n - 1) * 20 + pi.iorder as sort_order
  from psets p
  cross join bombas b
  cross join pump_items pi
  union all
  -- por sistema (estado del foso + panel general), después de las bombas
  select
    p.prefix || ' - ' || si.suffix as label,
    si.itype as item_type,
    p.base + 60 + si.iorder as sort_order
  from psets p
  cross join set_items si
  union all
  -- "No aplica" por sistema principal
  select * from ( values
    ('Bombas sumergibles - Foso elevador - No aplica', 'checkbox', 599),
    ('Bombas sumergibles - Sistema pluvial - No aplica', 'checkbox', 699),
    ('Bombas sumergibles - Sistema sanitario - No aplica', 'checkbox', 899)
  ) as na(label, item_type, sort_order)
)
insert into public.template_items (template_id, label, item_type, required, sort_order)
select t.id, g.label, g.item_type, false, g.sort_order
from tmpl t
cross join gen g;

commit;
