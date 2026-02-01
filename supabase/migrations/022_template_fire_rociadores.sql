BEGIN;

WITH upserted AS (
  INSERT INTO public.visit_templates (id, name, category, is_active)
  VALUES (
    gen_random_uuid(),
    'INSPECCIÓN PRUEBA Y MANTENIMIENTO DE SISTEMAS DE ROCIADORES NFPA25',
    'fire',
    true
  )
  ON CONFLICT (name) DO UPDATE
    SET category = EXCLUDED.category,
        is_active = EXCLUDED.is_active
  RETURNING id
)
INSERT INTO public.template_items (template_id, label, item_type, required, sort_order)
SELECT
  upserted.id,
  v.label,
  v.item_type,
  v.required,
  v.sort_order
FROM upserted
JOIN (
  VALUES
    ('Tipo de inspección', 'text', false, 10),
    ('Información de estacas', 'textarea', false, 20),
    ('Válvula reductora de presión estaca - Válvula sensora diferencial no esté descargando continuamente', 'checkbox', false, 30),
    ('Válvulas de control - Posición normal (abierta o cerrada)', 'checkbox', false, 40),
    ('Válvulas de control - Selladas, bloqueadas o supervisadas', 'checkbox', false, 50),
    ('Válvulas de control - Accesibles', 'checkbox', false, 60),
    ('Válvulas de control - Libres de fugas externas', 'checkbox', false, 70),
    ('Válvulas de control - Provistas de identificación apropiada', 'checkbox', false, 80),
    ('Manómetros - Operativo y no físicamente dañado', 'checkbox', false, 90),
    ('Válvulas de diluvio - Libre de daños físicos', 'checkbox', false, 100),
    ('Válvulas de diluvio - Posición normal (abierta o cerrada)', 'checkbox', false, 110),
    ('Válvulas de diluvio - Asiento de la válvula no presenta fuga', 'checkbox', false, 120),
    ('Válvulas de diluvio - Componentes eléctricos están en servicio', 'checkbox', false, 130),
    ('Comentarios/Observaciones', 'textarea', false, 140),
    ('Recibido por', 'text', false, 150),
    ('Realizado por', 'text', false, 160)
) AS v(label, item_type, required, sort_order) ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.template_items ti
  WHERE ti.template_id = upserted.id
    AND ti.label = v.label
    AND ti.sort_order = v.sort_order
);

COMMIT;
