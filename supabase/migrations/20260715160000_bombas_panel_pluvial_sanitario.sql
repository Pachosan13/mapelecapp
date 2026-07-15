-- Panel de Control para bombas sumergibles PLUVIAL y SANITARIO.
-- Feedback William Rodríguez (SEMCO), 15-jul-2026: las sumergibles de sanitario y pluvial a
-- veces tienen su propio panel de control (contactor/térmica, alternador, supervisor de voltaje,
-- luces piloto, selector en auto). Hoy no existía esa sección — solo las lecturas de contactor/
-- térmica por bomba. Mismo patrón que los tableros por sistema del 14-jul (reforzador/BCI/jockey).
--
-- Cada sección se gatilla SOLO si el edificio registra un panel (kind='panel_control') en ese
-- sistema — gating en lib/bombas/checklistFilter.ts (hasPluvialPanel / hasSanitarioPanel).
-- 🔴 EL CÓDIGO DEBE DESPLEGARSE ANTES QUE ESTE SQL: sin el gating, la sección cae al `return true`
-- del filtro y saldría en TODOS los edificios. Con el código live, sale solo donde hay panel.
--
-- Los 9 ítems (checkbox = Aprobado/Falla/N/A, es plantilla de bombas) son los que William inspecciona
-- en esos paneles. Sort_order: 970-978 (pluvial) y 980-988 (sanitario), justo tras el bloque de
-- sumergibles (601-966). ADITIVO + IDEMPOTENTE: NOT EXISTS por label; re-ejecutar no duplica.

begin;

with t as (
  select id from public.visit_templates where lower(name) like 'mantenimiento%bombas%' limit 1
)
insert into public.template_items (template_id, label, item_type, required, sort_order)
select t.id, v.label, 'checkbox', false, v.sort_order
from t
join (values
    -- ── Panel de Control - Sistema Pluvial ──
    ('Panel pluvial - Limpieza general', 970),
    ('Panel pluvial - Contactor/Térmica #1', 971),
    ('Panel pluvial - Contactor/Térmica #2', 972),
    ('Panel pluvial - Contactor/Térmica #3', 973),
    ('Panel pluvial - Contactor/Térmica #4', 974),
    ('Panel pluvial - Alternador', 975),
    ('Panel pluvial - Supervisor de voltaje', 976),
    ('Panel pluvial - Luces piloto', 977),
    ('Panel pluvial - Selector en Auto', 978),
    -- ── Panel de Control - Sistema Sanitario ──
    ('Panel sanitario - Limpieza general', 980),
    ('Panel sanitario - Contactor/Térmica #1', 981),
    ('Panel sanitario - Contactor/Térmica #2', 982),
    ('Panel sanitario - Contactor/Térmica #3', 983),
    ('Panel sanitario - Contactor/Térmica #4', 984),
    ('Panel sanitario - Alternador', 985),
    ('Panel sanitario - Supervisor de voltaje', 986),
    ('Panel sanitario - Luces piloto', 987),
    ('Panel sanitario - Selector en Auto', 988)
) as v(label, sort_order) on true
where not exists (
  select 1 from public.template_items x
  where x.template_id = t.id and x.label = v.label
);

commit;
