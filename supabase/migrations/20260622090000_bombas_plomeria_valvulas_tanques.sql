-- Feedback de William (SEMCO) — 22-jun-2026 (notas a mano sobre los screenshots + 2 notas de voz).
-- Template afectado: "Mantenimiento – Bombas".
--
-- Pedidos de William (reforzadoras + Bomba Jockey) + extensión por consistencia (OK de Pacho)
-- a "Bombas principales" y "Bomba contra incendio", que arrastraban el mismo término "Valvulería":
--   1) Terminología: "Valvulería" -> "Plomería"; "Plomeria/valvuleria ok" -> "Plomería ok".
--   2) Ítems de inspección nuevos (checkbox Aprobado/Falla/N/A):
--        - Check valve            -> secciones de bombeo + Bomba Jockey
--        - Válvula de alivio       -> secciones de bombeo
--        - Transductor de presión o switch de presión -> Bomba Jockey
--   3) "Tanque ok" -> se desglosa en "Tanque de reserva (ubicación)" + nuevo "Tanque de presión".
--      William (2ª ronda de audios): el tanque de reserva se especifica por ubicación —
--      el del sistema de transferencia es nivel inferior/sótano (Bombas principales) y el del
--      sistema reforzador es azotea/superior (Bomba reforzadora). El "Tanque de presión" se ofrece
--      en todas las secciones de bombeo y el técnico marca N/A donde no aplique.
--   4) "Presión constante" -> "Presión diferencial" en Bombas principales (William, flecha en foto).
--
-- El reclamo de "mediciones numéricas en sumergibles" se resolvió aparte con la migration
-- 20260617160000 (casillas number en Bombas sumergibles).
--
-- Solo DATA (template_items), no toca esquema. Aplicado en prod vía REST el 22-jun-2026;
-- este archivo es el registro reproducible e idempotente (UPDATEs por label viejo, INSERTs con NOT EXISTS).

begin;

-- ── 1) Terminología: Valvulería -> Plomería (todas las secciones del template) ──
update public.template_items
set label = replace(label, 'Valvulería en succión', 'Plomería en succión')
where template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and label like '% - Valvulería en succión';

update public.template_items
set label = replace(label, 'Valvulería en descarga', 'Plomería en descarga')
where template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and label like '% - Valvulería en descarga';

update public.template_items
set label = replace(label, 'Plomeria/valvuleria ok', 'Plomería ok')
where template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and label like '% - Plomeria/valvuleria ok';

-- ── 3a) Tanque ok -> Tanque de reserva (ubicación por sistema) ──
-- Bombas principales (sistema de transferencia) = tanque en sótano / nivel inferior.
update public.template_items
set label = 'Bombas principales - Tanque de reserva (sótano / nivel inferior)'
where template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and label = 'Bombas principales - Tanque ok';
-- Bombas reforzadoras (sistema reforzador) = tanque en azotea / nivel superior.
update public.template_items
set label = replace(label, 'Tanque ok', 'Tanque de reserva (azotea / nivel superior)')
where template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and label like 'Bomba reforzadora % - Tanque ok';

-- ── 4) Presión constante -> Presión diferencial (Bombas principales) ──
update public.template_items
set label = 'Bombas principales - Presión diferencial'
where template_id = (select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%')
  and label = 'Bombas principales - Presión constante';

-- ── 2 + 3b) Ítems nuevos (checkbox A/F/N/A), idempotentes ──
insert into public.template_items (template_id, label, item_type, required, sort_order)
select t.id, v.label, 'checkbox', false, v.sort_order
from (
  select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%'
) t
cross join (values
  -- Bombas principales (base 100)
  ('Bombas principales - Check valve', 172),
  ('Bombas principales - Válvula de alivio', 174),
  ('Bombas principales - Tanque de presión', 182),
  -- Bomba reforzadora 1 (base 300)
  ('Bomba reforzadora 1 - Check valve', 372),
  ('Bomba reforzadora 1 - Válvula de alivio', 374),
  ('Bomba reforzadora 1 - Tanque de presión', 382),
  -- Bomba reforzadora 2 (base 400)
  ('Bomba reforzadora 2 - Check valve', 472),
  ('Bomba reforzadora 2 - Válvula de alivio', 474),
  ('Bomba reforzadora 2 - Tanque de presión', 482),
  -- Bomba reforzadora 3 (base 500)
  ('Bomba reforzadora 3 - Check valve', 572),
  ('Bomba reforzadora 3 - Válvula de alivio', 574),
  ('Bomba reforzadora 3 - Tanque de presión', 582),
  -- Bomba contra incendio (base 1500, sin tanque)
  ('Bomba contra incendio - Check valve', 1537),
  ('Bomba contra incendio - Válvula de alivio', 1538),
  -- Bomba Jockey
  ('Bomba Jockey - Transductor de presión o switch de presión', 1565),
  ('Bomba Jockey - Check valve', 1570)
) as v(label, sort_order)
where not exists (
  select 1 from public.template_items x
  where x.template_id = t.id and x.label = v.label
);

commit;
