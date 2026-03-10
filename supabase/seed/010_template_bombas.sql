BEGIN;

WITH inserted_template AS (
  INSERT INTO public.visit_templates (id, name, category, version, is_active)
  VALUES (gen_random_uuid(), 'Mantenimiento – Bombas', 'bombas', 1, true)
  ON CONFLICT (name) DO NOTHING
  RETURNING id
),
template_id AS (
  SELECT id FROM inserted_template
  UNION ALL
  SELECT id FROM public.visit_templates WHERE name = 'Mantenimiento – Bombas' LIMIT 1
),
items AS (
  SELECT
    gen_random_uuid() AS id,
    (SELECT id FROM template_id) AS template_id,
    v.label,
    v.field_type,
    v.unit,
    v.section,
    v.asset_slot,
    v.required,
    v.order_index
  FROM (
    VALUES
      -- Encabezado
      ('Autorizado', 'text', NULL, 'Encabezado', NULL, false, 1),
      ('Observaciones', 'textarea', NULL, 'Encabezado', NULL, true, 2),

      -- Bombas Principales (principal_1)
      ('Voltaje L1-L2', 'number', 'V', 'Bombas Principales', 'principal_1', false, 1),
      ('Voltaje L2-L3', 'number', 'V', 'Bombas Principales', 'principal_1', false, 2),
      ('Voltaje L3-L1', 'number', 'V', 'Bombas Principales', 'principal_1', false, 3),
      ('Presión estática', 'number', 'PSI', 'Bombas Principales', 'principal_1', false, 4),
      ('Presión constante', 'number', 'PSI', 'Bombas Principales', 'principal_1', false, 5),
      ('Valvulería en succión', 'text', NULL, 'Bombas Principales', 'principal_1', false, 6),
      ('Valvulería en descarga', 'text', NULL, 'Bombas Principales', 'principal_1', false, 7),
      ('Plomería OK', 'checkbox', NULL, 'Bombas Principales', 'principal_1', false, 8),
      ('Valvulería OK', 'checkbox', NULL, 'Bombas Principales', 'principal_1', false, 9),
      ('Tanque de presión', 'number', 'PSI', 'Bombas Principales', 'principal_1', false, 10),
      ('Sensor de nivel', 'checkbox', NULL, 'Bombas Principales', 'principal_1', false, 11),

      -- Bombas Principales (principal_2)
      ('Voltaje L1-L2', 'number', 'V', 'Bombas Principales', 'principal_2', false, 1),
      ('Voltaje L2-L3', 'number', 'V', 'Bombas Principales', 'principal_2', false, 2),
      ('Voltaje L3-L1', 'number', 'V', 'Bombas Principales', 'principal_2', false, 3),
      ('Presión estática', 'number', 'PSI', 'Bombas Principales', 'principal_2', false, 4),
      ('Presión constante', 'number', 'PSI', 'Bombas Principales', 'principal_2', false, 5),
      ('Valvulería en succión', 'text', NULL, 'Bombas Principales', 'principal_2', false, 6),
      ('Valvulería en descarga', 'text', NULL, 'Bombas Principales', 'principal_2', false, 7),
      ('Plomería OK', 'checkbox', NULL, 'Bombas Principales', 'principal_2', false, 8),
      ('Valvulería OK', 'checkbox', NULL, 'Bombas Principales', 'principal_2', false, 9),
      ('Tanque de presión', 'number', 'PSI', 'Bombas Principales', 'principal_2', false, 10),
      ('Sensor de nivel', 'checkbox', NULL, 'Bombas Principales', 'principal_2', false, 11),

      -- Bombas Principales - Tablero (principal_1)
      ('Relay alternador', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_1', false, 1),
      ('Contactor/Térmica #1', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_1', false, 2),
      ('Contactor/Térmica #2', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_1', false, 3),
      ('Mini breaker', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_1', false, 4),
      ('Supervisor de voltaje', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_1', false, 5),
      ('Selectores', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_1', false, 6),
      ('Luces piloto', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_1', false, 7),
      ('Limpieza general', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_1', false, 8),
      ('Sensor de nivel', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_1', false, 9),

      -- Bombas Principales - Tablero (principal_2)
      ('Relay alternador', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_2', false, 1),
      ('Contactor/Térmica #1', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_2', false, 2),
      ('Contactor/Térmica #2', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_2', false, 3),
      ('Mini breaker', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_2', false, 4),
      ('Supervisor de voltaje', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_2', false, 5),
      ('Selectores', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_2', false, 6),
      ('Luces piloto', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_2', false, 7),
      ('Limpieza general', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_2', false, 8),
      ('Sensor de nivel', 'checkbox', NULL, 'Bombas Principales - Tablero', 'principal_2', false, 9),

      -- Bombas Reforzadoras (reforzadora_1)
      ('Voltaje L1-L2', 'number', 'V', 'Bombas Reforzadoras', 'reforzadora_1', false, 1),
      ('Voltaje L2-L3', 'number', 'V', 'Bombas Reforzadoras', 'reforzadora_1', false, 2),
      ('Voltaje L3-L1', 'number', 'V', 'Bombas Reforzadoras', 'reforzadora_1', false, 3),
      ('Presión arranque', 'number', 'PSI', 'Bombas Reforzadoras', 'reforzadora_1', false, 4),
      ('Presión parada', 'number', 'PSI', 'Bombas Reforzadoras', 'reforzadora_1', false, 5),
      ('Valvulería en succión', 'text', NULL, 'Bombas Reforzadoras', 'reforzadora_1', false, 6),
      ('Valvulería en descarga', 'text', NULL, 'Bombas Reforzadoras', 'reforzadora_1', false, 7),
      ('Plomería OK', 'checkbox', NULL, 'Bombas Reforzadoras', 'reforzadora_1', false, 8),
      ('Valvulería OK', 'checkbox', NULL, 'Bombas Reforzadoras', 'reforzadora_1', false, 9),
      ('Tanque de presión', 'number', 'PSI', 'Bombas Reforzadoras', 'reforzadora_1', false, 10),
      ('Sensor de nivel', 'checkbox', NULL, 'Bombas Reforzadoras', 'reforzadora_1', false, 11),

      -- Bombas Reforzadoras (reforzadora_2)
      ('Voltaje L1-L2', 'number', 'V', 'Bombas Reforzadoras', 'reforzadora_2', false, 1),
      ('Voltaje L2-L3', 'number', 'V', 'Bombas Reforzadoras', 'reforzadora_2', false, 2),
      ('Voltaje L3-L1', 'number', 'V', 'Bombas Reforzadoras', 'reforzadora_2', false, 3),
      ('Presión arranque', 'number', 'PSI', 'Bombas Reforzadoras', 'reforzadora_2', false, 4),
      ('Presión parada', 'number', 'PSI', 'Bombas Reforzadoras', 'reforzadora_2', false, 5),
      ('Valvulería en succión', 'text', NULL, 'Bombas Reforzadoras', 'reforzadora_2', false, 6),
      ('Valvulería en descarga', 'text', NULL, 'Bombas Reforzadoras', 'reforzadora_2', false, 7),
      ('Plomería OK', 'checkbox', NULL, 'Bombas Reforzadoras', 'reforzadora_2', false, 8),
      ('Valvulería OK', 'checkbox', NULL, 'Bombas Reforzadoras', 'reforzadora_2', false, 9),
      ('Tanque de presión', 'number', 'PSI', 'Bombas Reforzadoras', 'reforzadora_2', false, 10),
      ('Sensor de nivel', 'checkbox', NULL, 'Bombas Reforzadoras', 'reforzadora_2', false, 11),

      -- Bombas Reforzadoras (reforzadora_3)
      ('Voltaje L1-L2', 'number', 'V', 'Bombas Reforzadoras', 'reforzadora_3', false, 1),
      ('Voltaje L2-L3', 'number', 'V', 'Bombas Reforzadoras', 'reforzadora_3', false, 2),
      ('Voltaje L3-L1', 'number', 'V', 'Bombas Reforzadoras', 'reforzadora_3', false, 3),
      ('Presión arranque', 'number', 'PSI', 'Bombas Reforzadoras', 'reforzadora_3', false, 4),
      ('Presión parada', 'number', 'PSI', 'Bombas Reforzadoras', 'reforzadora_3', false, 5),
      ('Valvulería en succión', 'text', NULL, 'Bombas Reforzadoras', 'reforzadora_3', false, 6),
      ('Valvulería en descarga', 'text', NULL, 'Bombas Reforzadoras', 'reforzadora_3', false, 7),
      ('Plomería OK', 'checkbox', NULL, 'Bombas Reforzadoras', 'reforzadora_3', false, 8),
      ('Valvulería OK', 'checkbox', NULL, 'Bombas Reforzadoras', 'reforzadora_3', false, 9),
      ('Tanque de presión', 'number', 'PSI', 'Bombas Reforzadoras', 'reforzadora_3', false, 10),
      ('Sensor de nivel', 'checkbox', NULL, 'Bombas Reforzadoras', 'reforzadora_3', false, 11),

      -- Bombas Sumergibles (foso_elevador)
      ('No aplica', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', NULL, false, 1),
      ('Línea 1 con línea 2', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_1', false, 2),
      ('Línea 2 con línea 3', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_1', false, 3),
      ('Línea 3 con línea 1', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_1', false, 4),
      ('Voltaje', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_1', false, 5),
      ('Amperaje', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_1', false, 6),
      ('Jet valve', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_1', false, 7),
      ('Contactor térmica 1', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_1', false, 8),
      ('Contactor térmica 2', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_1', false, 9),
      ('Línea 1 con línea 2', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_2', false, 10),
      ('Línea 2 con línea 3', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_2', false, 11),
      ('Línea 3 con línea 1', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_2', false, 12),
      ('Voltaje', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_2', false, 13),
      ('Amperaje', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_2', false, 14),
      ('Jet valve', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_2', false, 15),
      ('Contactor térmica 1', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_2', false, 16),
      ('Contactor térmica 2', 'checkbox', NULL, 'Bombas Sumergibles - Foso elevador', 'foso_elevador_bomba_2', false, 17),

      -- Bombas Sumergibles (sistema_pluvial)
      ('No aplica', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', NULL, false, 1),
      ('Línea 1 con línea 2', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_1', false, 2),
      ('Línea 2 con línea 3', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_1', false, 3),
      ('Línea 3 con línea 1', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_1', false, 4),
      ('Voltaje', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_1', false, 5),
      ('Amperaje', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_1', false, 6),
      ('Jet valve', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_1', false, 7),
      ('Contactor térmica 1', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_1', false, 8),
      ('Contactor térmica 2', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_1', false, 9),
      ('Línea 1 con línea 2', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_2', false, 10),
      ('Línea 2 con línea 3', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_2', false, 11),
      ('Línea 3 con línea 1', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_2', false, 12),
      ('Voltaje', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_2', false, 13),
      ('Amperaje', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_2', false, 14),
      ('Jet valve', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_2', false, 15),
      ('Contactor térmica 1', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_2', false, 16),
      ('Contactor térmica 2', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_1_bomba_2', false, 17),
      ('Línea 1 con línea 2', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_1', false, 18),
      ('Línea 2 con línea 3', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_1', false, 19),
      ('Línea 3 con línea 1', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_1', false, 20),
      ('Voltaje', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_1', false, 21),
      ('Amperaje', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_1', false, 22),
      ('Jet valve', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_1', false, 23),
      ('Contactor térmica 1', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_1', false, 24),
      ('Contactor térmica 2', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_1', false, 25),
      ('Línea 1 con línea 2', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_2', false, 26),
      ('Línea 2 con línea 3', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_2', false, 27),
      ('Línea 3 con línea 1', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_2', false, 28),
      ('Voltaje', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_2', false, 29),
      ('Amperaje', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_2', false, 30),
      ('Jet valve', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_2', false, 31),
      ('Contactor térmica 1', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_2', false, 32),
      ('Contactor térmica 2', 'checkbox', NULL, 'Bombas Sumergibles - Sistema pluvial', 'pluvial_2_bomba_2', false, 33),

      -- Bombas Sumergibles (sistema_sanitario)
      ('No aplica', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', NULL, false, 1),
      ('Línea 1 con línea 2', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_1', false, 2),
      ('Línea 2 con línea 3', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_1', false, 3),
      ('Línea 3 con línea 1', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_1', false, 4),
      ('Voltaje', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_1', false, 5),
      ('Amperaje', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_1', false, 6),
      ('Jet valve', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_1', false, 7),
      ('Contactor térmica 1', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_1', false, 8),
      ('Contactor térmica 2', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_1', false, 9),
      ('Línea 1 con línea 2', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_2', false, 10),
      ('Línea 2 con línea 3', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_2', false, 11),
      ('Línea 3 con línea 1', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_2', false, 12),
      ('Voltaje', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_2', false, 13),
      ('Amperaje', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_2', false, 14),
      ('Jet valve', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_2', false, 15),
      ('Contactor térmica 1', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_2', false, 16),
      ('Contactor térmica 2', 'checkbox', NULL, 'Bombas Sumergibles - Sistema sanitario', 'sanitario_bomba_2', false, 17),

      -- Planta Eléctrica
      ('Marca', 'text', NULL, 'Planta Eléctrica', NULL, false, 1),
      ('Modelo', 'text', NULL, 'Planta Eléctrica', NULL, false, 2),
      ('Fecha batería', 'text', NULL, 'Planta Eléctrica', NULL, false, 3),
      ('Amperaje batería', 'number', 'A', 'Planta Eléctrica', NULL, false, 4),
      ('Voltaje batería #1', 'number', 'V', 'Planta Eléctrica', NULL, false, 5),
      ('Voltaje batería #2', 'number', 'V', 'Planta Eléctrica', NULL, false, 6),
      ('Nivel combustible', 'number', '%', 'Planta Eléctrica', NULL, false, 7),
      ('Encendido automático', 'checkbox', NULL, 'Planta Eléctrica', NULL, false, 8),
      ('Prueba transfer', 'checkbox', NULL, 'Planta Eléctrica', NULL, false, 9),
      ('Cargador batería', 'checkbox', NULL, 'Planta Eléctrica', NULL, false, 10),
      ('Revisión correas', 'checkbox', NULL, 'Planta Eléctrica', NULL, false, 11),
      ('Nivel refrigerante', 'checkbox', NULL, 'Planta Eléctrica', NULL, false, 12),
      ('Estado lubricante', 'checkbox', NULL, 'Planta Eléctrica', NULL, false, 13),
      ('Limpieza general', 'checkbox', NULL, 'Planta Eléctrica', NULL, false, 14)
  ) AS v(label, field_type, unit, section, asset_slot, required, order_index)
)
INSERT INTO public.template_items (
  id,
  template_id,
  label,
  field_type,
  unit,
  section,
  asset_slot,
  required,
  order_index
)
SELECT
  items.id,
  items.template_id,
  items.label,
  items.field_type,
  items.unit,
  items.section,
  items.asset_slot,
  items.required,
  items.order_index
FROM items
WHERE NOT EXISTS (
  SELECT 1
  FROM public.template_items ti
  WHERE ti.template_id = items.template_id
    AND ti.label = items.label
    AND ti.section = items.section
    AND ti.asset_slot IS NOT DISTINCT FROM items.asset_slot
);

COMMIT;
