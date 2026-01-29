-- supabase/migrations/018_template_bombas_full.sql

BEGIN;

DO $$
DECLARE
  v_template_id uuid;
BEGIN
  -- upsert template (name único)
  INSERT INTO public.visit_templates (id, name, category, is_active)
  VALUES (gen_random_uuid(), 'Mantenimiento – Bombas', 'pump', true)
  ON CONFLICT (name) DO UPDATE
    SET category = EXCLUDED.category,
        is_active = EXCLUDED.is_active;

  SELECT id INTO v_template_id
  FROM public.visit_templates
  WHERE name = 'Mantenimiento – Bombas'
  LIMIT 1;

  INSERT INTO public.template_items (template_id, label, item_type, required, sort_order)
  SELECT
    v_template_id,
    v.label,
    v.item_type,
    v.required,
    v.sort_order
  FROM (
    VALUES
      ('Autorizado por', 'text', false, 10),
      ('Observaciones', 'textarea', true, 20),

      ('Bombas principales - Voltaje L1-L2', 'number', false, 100),
      ('Bombas principales - Voltaje L2-L3', 'number', false, 110),
      ('Bombas principales - Voltaje L1-L3', 'number', false, 120),
      ('Bombas principales - Presion arranque', 'number', false, 130),
      ('Bombas principales - Presion parada', 'number', false, 140),
      ('Bombas principales - Presion succion', 'number', false, 150),
      ('Bombas principales - Presion descarga', 'number', false, 160),
      ('Bombas principales - Plomeria/valvuleria ok', 'checkbox', false, 170),
      ('Bombas principales - Tanque ok', 'checkbox', false, 180),

      ('Tablero - Limpio/ordenado', 'checkbox', false, 200),
      ('Tablero - Luces piloto ok', 'checkbox', false, 210),
      ('Tablero - Protecciones ok', 'checkbox', false, 220),

      ('Bomba reforzadora 1 - Voltaje L1-L2', 'number', false, 300),
      ('Bomba reforzadora 1 - Voltaje L2-L3', 'number', false, 310),
      ('Bomba reforzadora 1 - Voltaje L1-L3', 'number', false, 320),
      ('Bomba reforzadora 1 - Presion arranque', 'number', false, 330),
      ('Bomba reforzadora 1 - Presion parada', 'number', false, 340),
      ('Bomba reforzadora 1 - Presion succion', 'number', false, 350),
      ('Bomba reforzadora 1 - Presion descarga', 'number', false, 360),
      ('Bomba reforzadora 1 - Plomeria/valvuleria ok', 'checkbox', false, 370),
      ('Bomba reforzadora 1 - Tanque ok', 'checkbox', false, 380),

      ('Bomba reforzadora 2 - Voltaje L1-L2', 'number', false, 400),
      ('Bomba reforzadora 2 - Voltaje L2-L3', 'number', false, 410),
      ('Bomba reforzadora 2 - Voltaje L1-L3', 'number', false, 420),
      ('Bomba reforzadora 2 - Presion arranque', 'number', false, 430),
      ('Bomba reforzadora 2 - Presion parada', 'number', false, 440),
      ('Bomba reforzadora 2 - Presion succion', 'number', false, 450),
      ('Bomba reforzadora 2 - Presion descarga', 'number', false, 460),
      ('Bomba reforzadora 2 - Plomeria/valvuleria ok', 'checkbox', false, 470),
      ('Bomba reforzadora 2 - Tanque ok', 'checkbox', false, 480),

      ('Bomba reforzadora 3 - Voltaje L1-L2', 'number', false, 500),
      ('Bomba reforzadora 3 - Voltaje L2-L3', 'number', false, 510),
      ('Bomba reforzadora 3 - Voltaje L1-L3', 'number', false, 520),
      ('Bomba reforzadora 3 - Presion arranque', 'number', false, 530),
      ('Bomba reforzadora 3 - Presion parada', 'number', false, 540),
      ('Bomba reforzadora 3 - Presion succion', 'number', false, 550),
      ('Bomba reforzadora 3 - Presion descarga', 'number', false, 560),
      ('Bomba reforzadora 3 - Plomeria/valvuleria ok', 'checkbox', false, 570),
      ('Bomba reforzadora 3 - Tanque ok', 'checkbox', false, 580),

      ('Planta electrica - Marca', 'text', false, 600),
      ('Planta electrica - Modelo', 'text', false, 610),
      ('Planta electrica - Baterias ok', 'checkbox', false, 620),
      ('Planta electrica - Combustible ok', 'checkbox', false, 630),
      ('Planta electrica - Arranque automatico ok', 'checkbox', false, 640),
      ('Planta electrica - Alarmas ok', 'checkbox', false, 650),

      ('Entrega - Entregado por', 'text', false, 700),
      ('Entrega - Recibido por', 'text', false, 710),
      ('Entrega - Fecha', 'text', false, 720),
      ('Entrega - Firma/confirmacion', 'checkbox', false, 730)
  ) AS v(label, item_type, required, sort_order)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.template_items ti
    WHERE ti.template_id = v_template_id
      AND ti.label = v.label
      AND ti.sort_order = v.sort_order
  );
END $$;

COMMIT;
