BEGIN;

WITH upserted AS (
  INSERT INTO public.visit_templates (id, name, category, is_active)
  VALUES (
    gen_random_uuid(),
    'IPM DE BOMBA CONTRA INCENDIO NFPA25',
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
    ('Datos de bomba - Caudal', 'number', false, 10),
    ('Datos de bomba - Presión', 'number', false, 20),
    ('Datos de bomba - Motor', 'text', false, 30),
    ('Identificación de bomba/equipo (opcional)', 'text', false, 40),
    ('Sistema de bombas diésel - El tanque de combustible está lleno en al menos dos tercios', 'checkbox', false, 50),
    ('Sistema de bombas diésel - El interruptor del selector del controlador está en posición automática', 'checkbox', false, 60),
    ('Sistema de bombas diésel - Las lecturas del voltaje de las baterías (2) están dentro del rango aceptable', 'checkbox', false, 70),
    ('Sistema de bombas diésel - Las lecturas de la corriente de carga de las baterías (2) están dentro del rango aceptable', 'checkbox', false, 80),
    ('Sistema de bombas diésel - Las luces del piloto de las baterías (2) están encendidas o las luces del piloto de falla de las baterías (2) están apagadas', 'checkbox', false, 90),
    ('Sistema de bombas diésel - Todas las luces del piloto de la alarma están apagadas', 'checkbox', false, 100),
    ('Sistema de bombas diésel - El medidor de tiempo de funcionamiento del motor toma la correspondiente lectura', 'checkbox', false, 110),
    ('Sistema de bombas diésel - El nivel de aceite en el impulsor de los engranajes de ángulo recto está dentro del rango aceptable', 'checkbox', false, 120),
    ('Sistema de bombas diésel - El nivel de aceite del cárter está dentro del rango aceptable', 'checkbox', false, 130),
    ('Sistema de bombas diésel - El nivel de agua de refrigeración está dentro del rango aceptable', 'checkbox', false, 140),
    ('Sistema de bombas diésel - El nivel de electrolitos de las baterías está dentro del rango aceptable', 'checkbox', false, 150),
    ('Sistema de bombas eléctricas - La luz del piloto del controlador (encendido) está iluminada', 'checkbox', false, 160),
    ('Sistema de bombas eléctricas - La luz normal del piloto del interruptor de transferencia está iluminada', 'checkbox', false, 170),
    ('Sistema de bombas eléctricas - El interruptor de aislamiento está cerrado - fuente de reserva de emergencia', 'checkbox', false, 180),
    ('Sistema de bombas eléctricas - La luz del piloto de la alarma de fase invertida está apagada o la luz del piloto de rotación de fase normal está apagada', 'checkbox', false, 190),
    ('Sistema de bombas eléctricas - El nivel de aceite del visor de vidrio del motor vertical está dentro del rango aceptable', 'checkbox', false, 200),
    ('Sistema de bombas eléctricas - Se abastece de energía a la bomba de mantenimiento de presión', 'checkbox', false, 210),
    ('Bomba - Las válvulas de succión, de descarga y derivación de bomba están totalmente abiertas', 'checkbox', false, 220),
    ('Bomba - Las tuberías no presentan fugas', 'checkbox', false, 230),
    ('Bomba - La lectura del manómetro de la línea de succión está dentro del rango aceptable', 'checkbox', false, 240),
    ('Bomba - La lectura del manómetro de la línea del sistema está dentro del rango aceptable', 'checkbox', false, 250),
    ('Bomba - El reservorio de succión tiene el nivel de agua requerido', 'checkbox', false, 260),
    ('Bomba - Las rejillas de succión de pozo húmedo no presentan obstrucciones y están debidamente colocadas', 'checkbox', false, 270),
    ('Bomba - Las válvulas de las pruebas de flujo de agua están en posición cerradas; la válvula de la conexión de la manguera está cerrada y la línea hacia las válvulas de prueba no contiene agua', 'checkbox', false, 280),
    ('Caseta/Cuarto de bomba - Las rejillas de ventilación funcionan sin inconvenientes', 'checkbox', false, 290),
    ('Caseta/Cuarto de bomba - No se acumula exceso de agua en el piso', 'checkbox', false, 300),
    ('Caseta/Cuarto de bomba - Protección de acoplamiento adecuada', 'checkbox', false, 310),
    ('Pruebas sin flujo - Bomba contra incendio accionada por motor diésel - Prueba sin flujo', 'checkbox', false, 320),
    ('Pruebas sin flujo - Bomba contra incendio accionada por motor eléctrico - Prueba sin flujo', 'checkbox', false, 330),
    ('Comentarios', 'textarea', false, 340),
    ('Recibido por', 'text', false, 350),
    ('Realizado por', 'text', false, 360)
) AS v(label, item_type, required, sort_order) ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.template_items ti
  WHERE ti.template_id = upserted.id
    AND ti.label = v.label
    AND ti.sort_order = v.sort_order
);

COMMIT;
