BEGIN;

WITH upserted AS (
  INSERT INTO public.visit_templates (id, name, category, is_active)
  VALUES (
    gen_random_uuid(),
    'RECORRIDO CONTRA INCENDIO',
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
    ('Proyecto', 'text', false, 10),
    ('Inspección (Red Sistema Contra Incendio)', 'text', false, 20),
    ('Recorrido por pisos (Piso | Presión entrada (psi) | Presión salida (psi) | Estación control abierta | Estación control cerrada | Válvula reguladora | Estado manómetro | Gabinetes/manguera | Extintores)', 'textarea', false, 30),
    ('Observaciones', 'textarea', false, 40)
) AS v(label, item_type, required, sort_order) ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.template_items ti
  WHERE ti.template_id = upserted.id
    AND ti.label = v.label
    AND ti.sort_order = v.sort_order
);

COMMIT;
