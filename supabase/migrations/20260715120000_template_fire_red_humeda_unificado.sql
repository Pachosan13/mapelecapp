-- RED HÚMEDA CONTRA INCENDIOS — formulario unificado.
-- Feedback William Rodríguez (SEMCO), 14-jul-2026: hoy IPM de bomba, Recorrido y Rociadores
-- son 3 formularios separados; el técnico firma 3 veces por torre (y se ven 6 con 2 torres).
-- Pidió unificarlos por edificio para que salgan juntos y sea UNA sola firma por torre/proyecto.
--
-- Arquitectura de la app: 1 visita = 1 formulario (template) = 1 firma. Por eso la solución
-- es UN template nuevo que contiene los 3 como secciones, no 3 visitas. Cero cambio de código.
--
-- Agrupación (render y PDF agrupan por el prefijo del label antes del primer " - "):
--   • Cada sección se etiqueta con su formulario usando " · " (ej. "IPM · Datos de bomba").
--   • El único ítem sin tag es la tabla "Recorrido por pisos": el render/PDF la detecta por
--     que el label EMPIEZA con "Recorrido por pisos" (startsWith en 4 lugares) — no se toca.
--   • Los 3 "Recibido por / Realizado por" se colapsan en UN solo par al final ("Firma y cierre").
--
-- ADITIVO + IDEMPOTENTE: usa ON CONFLICT (name) y NOT EXISTS por (label, sort_order), como
-- 022/023/024. Re-ejecutar no duplica. NO borra ni modifica ítems de los formularios viejos.

BEGIN;

WITH upserted AS (
  INSERT INTO public.visit_templates (id, name, category, is_active)
  VALUES (
    gen_random_uuid(),
    'RED HÚMEDA CONTRA INCENDIOS',
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
    -- ══════════════ IPM DE BOMBA CONTRA INCENDIO NFPA25 ══════════════
    ('IPM · Datos de bomba - Caudal', 'number', false, 1010),
    ('IPM · Datos de bomba - Presión', 'number', false, 1020),
    ('IPM · Datos de bomba - Motor', 'text', false, 1030),
    ('IPM · Datos de bomba - Identificación de bomba/equipo (opcional)', 'text', false, 1040),
    ('IPM · Sistema de bombas diésel - El tanque de combustible está lleno en al menos dos tercios', 'checkbox', false, 1050),
    ('IPM · Sistema de bombas diésel - El interruptor del selector del controlador está en posición automática', 'checkbox', false, 1060),
    ('IPM · Sistema de bombas diésel - Las lecturas del voltaje de las baterías (2) están dentro del rango aceptable', 'checkbox', false, 1070),
    ('IPM · Sistema de bombas diésel - Las lecturas de la corriente de carga de las baterías (2) están dentro del rango aceptable', 'checkbox', false, 1080),
    ('IPM · Sistema de bombas diésel - Las luces del piloto de las baterías (2) están encendidas o las luces del piloto de falla de las baterías (2) están apagadas', 'checkbox', false, 1090),
    ('IPM · Sistema de bombas diésel - Todas las luces del piloto de la alarma están apagadas', 'checkbox', false, 1100),
    ('IPM · Sistema de bombas diésel - El medidor de tiempo de funcionamiento del motor toma la correspondiente lectura', 'checkbox', false, 1110),
    ('IPM · Sistema de bombas diésel - El nivel de aceite en el impulsor de los engranajes de ángulo recto está dentro del rango aceptable', 'checkbox', false, 1120),
    ('IPM · Sistema de bombas diésel - El nivel de aceite del cárter está dentro del rango aceptable', 'checkbox', false, 1130),
    ('IPM · Sistema de bombas diésel - El nivel de agua de refrigeración está dentro del rango aceptable', 'checkbox', false, 1140),
    ('IPM · Sistema de bombas diésel - El nivel de electrolitos de las baterías está dentro del rango aceptable', 'checkbox', false, 1150),
    ('IPM · Sistema de bombas eléctricas - La luz del piloto del controlador (encendido) está iluminada', 'checkbox', false, 1160),
    ('IPM · Sistema de bombas eléctricas - La luz normal del piloto del interruptor de transferencia está iluminada', 'checkbox', false, 1170),
    ('IPM · Sistema de bombas eléctricas - El interruptor de aislamiento está cerrado - fuente de reserva de emergencia', 'checkbox', false, 1180),
    ('IPM · Sistema de bombas eléctricas - La luz del piloto de la alarma de fase invertida está apagada o la luz del piloto de rotación de fase normal está apagada', 'checkbox', false, 1190),
    ('IPM · Sistema de bombas eléctricas - El nivel de aceite del visor de vidrio del motor vertical está dentro del rango aceptable', 'checkbox', false, 1200),
    ('IPM · Sistema de bombas eléctricas - Se abastece de energía a la bomba de mantenimiento de presión', 'checkbox', false, 1210),
    ('IPM · Bomba - Las válvulas de succión, de descarga y derivación de bomba están totalmente abiertas', 'checkbox', false, 1220),
    ('IPM · Bomba - Las tuberías no presentan fugas', 'checkbox', false, 1230),
    ('IPM · Bomba - La lectura del manómetro de la línea de succión está dentro del rango aceptable', 'checkbox', false, 1240),
    ('IPM · Bomba - La lectura del manómetro de la línea del sistema está dentro del rango aceptable', 'checkbox', false, 1250),
    ('IPM · Bomba - El reservorio de succión tiene el nivel de agua requerido', 'checkbox', false, 1260),
    ('IPM · Bomba - Las rejillas de succión de pozo húmedo no presentan obstrucciones y están debidamente colocadas', 'checkbox', false, 1270),
    ('IPM · Bomba - Las válvulas de las pruebas de flujo de agua están en posición cerradas; la válvula de la conexión de la manguera está cerrada y la línea hacia las válvulas de prueba no contiene agua', 'checkbox', false, 1280),
    ('IPM · Caseta/Cuarto de bomba - Las rejillas de ventilación funcionan sin inconvenientes', 'checkbox', false, 1290),
    ('IPM · Caseta/Cuarto de bomba - No se acumula exceso de agua en el piso', 'checkbox', false, 1300),
    ('IPM · Caseta/Cuarto de bomba - Protección de acoplamiento adecuada', 'checkbox', false, 1310),
    ('IPM · Pruebas sin flujo - Bomba contra incendio accionada por motor diésel - Prueba sin flujo', 'checkbox', false, 1320),
    ('IPM · Pruebas sin flujo - Bomba contra incendio accionada por motor eléctrico - Prueba sin flujo', 'checkbox', false, 1330),
    ('IPM · Comentarios - Comentarios IPM de bomba', 'textarea', false, 1340),

    -- ══════════════ RECORRIDO CONTRA INCENDIO ══════════════
    ('Recorrido · Datos - Proyecto', 'text', false, 2010),
    ('Recorrido · Datos - Inspección (Red Sistema Contra Incendio)', 'text', false, 2020),
    ('Recorrido por pisos - Piso | Presión entrada (psi) | Presión salida (psi) | Estación control abierta | Estación control cerrada | Válvula reguladora | Estado manómetro | Gabinetes/manguera | Extintores', 'textarea', false, 2030),
    ('Recorrido · Datos - Observaciones del recorrido', 'textarea', false, 2040),

    -- ══════════════ INSPECCIÓN Y MANTENIMIENTO DE ROCIADORES NFPA25 ══════════════
    ('Rociadores · Datos - Tipo de inspección', 'text', false, 3010),
    ('Rociadores · Datos - Información de estacas', 'textarea', false, 3020),
    ('Rociadores · Válvula reductora de presión estaca - Válvula sensora diferencial no esté descargando continuamente', 'checkbox', false, 3030),
    ('Rociadores · Válvulas de control - Posición normal (abierta o cerrada)', 'checkbox', false, 3040),
    ('Rociadores · Válvulas de control - Selladas, bloqueadas o supervisadas', 'checkbox', false, 3050),
    ('Rociadores · Válvulas de control - Accesibles', 'checkbox', false, 3060),
    ('Rociadores · Válvulas de control - Libres de fugas externas', 'checkbox', false, 3070),
    ('Rociadores · Válvulas de control - Provistas de identificación apropiada', 'checkbox', false, 3080),
    ('Rociadores · Manómetros - Operativo y no físicamente dañado', 'checkbox', false, 3090),
    ('Rociadores · Válvulas de diluvio - Libre de daños físicos', 'checkbox', false, 3100),
    ('Rociadores · Válvulas de diluvio - Posición normal (abierta o cerrada)', 'checkbox', false, 3110),
    ('Rociadores · Válvulas de diluvio - Asiento de la válvula no presenta fuga', 'checkbox', false, 3120),
    ('Rociadores · Válvulas de diluvio - Componentes eléctricos están en servicio', 'checkbox', false, 3130),
    ('Rociadores · Comentarios - Comentarios/Observaciones de rociadores', 'textarea', false, 3140),

    -- ══════════════ CIERRE (una sola firma para toda la red húmeda) ══════════════
    ('Firma y cierre - Recibido por', 'text', false, 9010),
    ('Firma y cierre - Realizado por', 'text', false, 9020)
) AS v(label, item_type, required, sort_order) ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.template_items ti
  WHERE ti.template_id = upserted.id
    AND ti.label = v.label
    AND ti.sort_order = v.sort_order
);

-- Reemplazo (decidido con Pacho 15-jul): los 3 formularios sueltos salen del selector de
-- "Nueva visita". William solo ve "RED HÚMEDA CONTRA INCENDIOS". Las visitas ya creadas con
-- estos templates y sus PDFs quedan INTACTOS (solo se apaga is_active). Reversible: is_active=true.
-- "MANTENIMIENTO MENSUAL SISTEMA DE PRESURIZACIÓN DE ESCALERAS" NO se toca (no era parte del pedido).
UPDATE public.visit_templates
SET is_active = false
WHERE name IN (
  'IPM DE BOMBA CONTRA INCENDIO NFPA25',
  'RECORRIDO CONTRA INCENDIO',
  'INSPECCIÓN PRUEBA Y MANTENIMIENTO DE SISTEMAS DE ROCIADORES NFPA25'
);

COMMIT;
