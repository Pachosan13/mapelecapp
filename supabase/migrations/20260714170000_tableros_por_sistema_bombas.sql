-- Tableros (paneles de control) POR SISTEMA en la plantilla "Mantenimiento – Bombas".
-- Feedback William Rodríguez (SEMCO), 14-jul-2026: antes solo existía un "Tablero" genérico
-- (el de bombas principales); cada sistema con panel necesita el suyo para poder llenarlo.
--
-- Agrega 3 grupos: reforzador (mismos ítems que principales), contra incendios (BCI, NFPA)
-- y jockey. Cada grupo se muestra solo si el sistema tiene su panel registrado (gating en
-- lib/bombas/checklistFilter.ts — DEBE deployarse el código ANTES que este SQL).
--
-- ADITIVO + IDEMPOTENTE: no borra ni modifica ítems existentes; re-ejecutar no duplica.
-- El display bonito ("Panel de Control - …") lo pone el render/PDF, no el label interno.

with nuevos(label, sort_order) as (
  values
    -- Panel de Control - Sistema Reforzador (mismos ítems que Bombas Principales)
    ('Tablero reforzador - Limpio/ordenado', 591),
    ('Tablero reforzador - Luces piloto ok', 592),
    ('Tablero reforzador - Protecciones ok', 593),
    ('Tablero reforzador - Apriete de terminales', 594),
    ('Tablero reforzador - Contactor/Térmica', 595),
    ('Tablero reforzador - Mini breaker', 596),
    ('Tablero reforzador - Supervisor de voltaje', 597),
    ('Tablero reforzador - Relay alternador', 598),
    -- Panel de la Bomba Principal Contra Incendios (NFPA)
    ('Panel contra incendios - Panel limpio y ordenado', 1571),
    ('Panel contra incendios - Display operativo y sin alarmas', 1572),
    ('Panel contra incendios - Selector en AUTO', 1573),
    ('Panel contra incendios - Luces piloto funcionando', 1574),
    ('Panel contra incendios - Voltaje de alimentación normal', 1575),
    ('Panel contra incendios - Verificación de pérdida o inversión de fase', 1576),
    ('Panel contra incendios - Terminales y conexiones sin calentamiento', 1577),
    ('Panel contra incendios - Cargador de baterías operativo (si diésel)', 1578),
    ('Panel contra incendios - Presostato o transductor operativo', 1579),
    ('Panel contra incendios - Registro de eventos y fallas revisado', 1580),
    ('Panel contra incendios - Arranque automático por caída de presión', 1581),
    ('Panel contra incendios - Estado del interruptor principal (breaker)', 1582),
    ('Panel contra incendios - Estado general del panel', 1583),
    -- Panel de la Bomba Jockey
    ('Panel jockey - Panel limpio y ordenado', 1584),
    ('Panel jockey - Display operativo y sin alarmas', 1585),
    ('Panel jockey - Selector en AUTO', 1586),
    ('Panel jockey - Voltaje de alimentación normal', 1587),
    ('Panel jockey - Corriente del motor dentro de su rango', 1588),
    ('Panel jockey - Relé térmico ajustado correctamente', 1589),
    ('Panel jockey - Contactor en buen estado', 1590),
    ('Panel jockey - Presión de arranque y parada correctas', 1591),
    ('Panel jockey - Presostato o transductor operativo', 1592),
    ('Panel jockey - Arranque y parada automáticos operativos', 1593),
    ('Panel jockey - Estado general del panel', 1594)
),
tpl as (select 'b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid as id)
insert into template_items (template_id, label, item_type, required, sort_order)
select tpl.id, n.label, 'checkbox', false, n.sort_order
from nuevos n cross join tpl
where not exists (
  select 1 from template_items ti
  where ti.template_id = tpl.id and ti.label = n.label
);
