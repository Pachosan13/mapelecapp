-- RED HÚMEDA CONTRA INCENDIOS: el bloque de rociadores pasa a estar por PERIODICIDAD.
--
-- Feedback William Rodríguez (SEMCO, 24-ago-2026). Primero: "en el formato de rociadores
-- tienen que colocar no aplica muchas veces. Generalmente solo usamos el mensual". Y al ver
-- el arreglo: "el formato de red húmeda llevaría todos los formatos de red… es que entré y
-- no vi lo de mensual trimestral o la opción que desglose la deseada".
--
-- Sus técnicos NO abren el formato de rociadores suelto (`a74182b1`, que además está
-- is_active=false): abren RED HÚMEDA (`f8121a9d`), y su bloque de rociadores traía solo los
-- 11 ítems MENSUALES, agrupados por equipo y sin ninguna marca de periodicidad. Por eso el
-- selector de frecuencia no le aparecía: `tieneBloquesPorFrecuencia` mira los labels y ahí
-- no había ninguno.
--
-- Este script hace dos cosas:
--   1. RENOMBRA los 11 mensuales que ya existen a "Rociadores · Mensual - …" (mismo texto
--      que el formato suelto). NO se tocan ids: `visit_responses` apunta por `item_id`, así
--      que los informes históricos siguen enteros, solo cambia el encabezado del bloque.
--   2. AGREGA los 60 ítems que faltaban: Trimestral 21 · Semestral 3 · Anual 28 · Cada 5 años 8.
--
-- Con eso `lib/fire/frecuencia.ts` ve 5 periodicidades y pinta el selector solo — está hecho
-- para leer el anidado con " · ", no hay que tocar código.
--
-- `Rociadores · Datos - Tipo de inspección` (3010) ya existe y es el campo que maneja el
-- selector. `Rociadores · Comentarios` (3140) y `Firma y cierre` (9010-9020) no llevan
-- periodicidad, así que NUNCA se esconden.
--
-- ADITIVO + IDEMPOTENTE: los UPDATE casan por label viejo (correr de nuevo no hace nada) y
-- los INSERT van con NOT EXISTS por (template_id, label). Rango 3200-3970, libre entre el
-- bloque de rociadores (termina en 3140) y la firma (9010).
--
-- ⚠️ CUÁNDO CORRERLO: con CERO visitas de RED HÚMEDA en `in_progress`. Un técnico a media
-- visita pasa de 54 a 114 ítems de golpe, y hasta que elija periodicidad el validador se los
-- pide todos. Chequeo previo:
--   select count(*) from visits
--    where template_id = 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa' and status = 'in_progress';

BEGIN;

-- ── 1. Los 11 mensuales que ya existen pasan a llamarse por su periodicidad ──
UPDATE public.template_items SET label = 'Rociadores · Mensual - Válvula reductora de presión estaca: válvula sensora diferencial no esté descargando continuamente'
 WHERE template_id = 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa' AND label = 'Rociadores · Válvula reductora de presión estaca - Válvula sensora diferencial no esté descargando continuamente';
UPDATE public.template_items SET label = 'Rociadores · Mensual - Válvulas de control: posición normal (abierta o cerrada)'
 WHERE template_id = 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa' AND label = 'Rociadores · Válvulas de control - Posición normal (abierta o cerrada)';
UPDATE public.template_items SET label = 'Rociadores · Mensual - Válvulas de control: selladas, bloqueadas o supervisadas'
 WHERE template_id = 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa' AND label = 'Rociadores · Válvulas de control - Selladas, bloqueadas o supervisadas';
UPDATE public.template_items SET label = 'Rociadores · Mensual - Válvulas de control: accesibles'
 WHERE template_id = 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa' AND label = 'Rociadores · Válvulas de control - Accesibles';
UPDATE public.template_items SET label = 'Rociadores · Mensual - Válvulas de control: libres de fugas externas'
 WHERE template_id = 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa' AND label = 'Rociadores · Válvulas de control - Libres de fugas externas';
UPDATE public.template_items SET label = 'Rociadores · Mensual - Válvulas de control: provistas de identificación apropiada'
 WHERE template_id = 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa' AND label = 'Rociadores · Válvulas de control - Provistas de identificación apropiada';
UPDATE public.template_items SET label = 'Rociadores · Mensual - Manómetros: operativo y no físicamente dañado'
 WHERE template_id = 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa' AND label = 'Rociadores · Manómetros - Operativo y no físicamente dañado';
UPDATE public.template_items SET label = 'Rociadores · Mensual - Válvulas de diluvio: libre de daños físicos'
 WHERE template_id = 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa' AND label = 'Rociadores · Válvulas de diluvio - Libre de daños físicos';
UPDATE public.template_items SET label = 'Rociadores · Mensual - Válvulas de diluvio: posición normal (abierta o cerrada)'
 WHERE template_id = 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa' AND label = 'Rociadores · Válvulas de diluvio - Posición normal (abierta o cerrada)';
UPDATE public.template_items SET label = 'Rociadores · Mensual - Válvulas de diluvio: asiento de la válvula no presenta fuga'
 WHERE template_id = 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa' AND label = 'Rociadores · Válvulas de diluvio - Asiento de la válvula no presenta fuga';
UPDATE public.template_items SET label = 'Rociadores · Mensual - Válvulas de diluvio: componentes eléctricos están en servicio'
 WHERE template_id = 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa' AND label = 'Rociadores · Válvulas de diluvio - Componentes eléctricos están en servicio';

-- ── 2. Los 60 ítems que faltaban ──
INSERT INTO public.template_items (template_id, label, item_type, required, sort_order)
SELECT 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa', v.label, v.item_type, false, v.sort_order
FROM (
  VALUES
    ('Rociadores · Trimestral - Dispositivo de alarmas de flujo de agua: libre de daño físico', 'checkbox', 3200),
    ('Rociadores · Trimestral - Dispositivo de señal de supervisión de válvula: libre de daño físico', 'checkbox', 3210),
    ('Rociadores · Trimestral - Conexiones del cuerpo de bomberos (siamesa): son visibles y accesibles', 'checkbox', 3220),
    ('Rociadores · Trimestral - Conexiones del cuerpo de bomberos (siamesa): acoplamientos giratorios no están dañados y rotan sin inconveniente', 'checkbox', 3230),
    ('Rociadores · Trimestral - Conexiones del cuerpo de bomberos (siamesa): las tapas están debidamente colocadas y sin daños', 'checkbox', 3240),
    ('Rociadores · Trimestral - Conexiones del cuerpo de bomberos (siamesa): los empaques están debidamente colocados', 'checkbox', 3250),
    ('Rociadores · Trimestral - Conexiones del cuerpo de bomberos (siamesa): la válvula de retención no presenta fuga', 'checkbox', 3260),
    ('Rociadores · Trimestral - Conexiones del cuerpo de bomberos (siamesa): la conexión está debidamente colocada y funciona apropiadamente', 'checkbox', 3270),
    ('Rociadores · Trimestral - Conexiones del cuerpo de bomberos (siamesa): inspeccionar si hay obstrucciones', 'checkbox', 3280),
    ('Rociadores · Trimestral - Conexiones del cuerpo de bomberos (siamesa): las tuberías visibles no presentan daños', 'checkbox', 3290),
    ('Rociadores · Trimestral - Válvula reductora de presión de ramales: posición abierta', 'checkbox', 3300),
    ('Rociadores · Trimestral - Válvula reductora de presión de ramales: sin fugas', 'checkbox', 3310),
    ('Rociadores · Trimestral - Válvula reductora de presión de ramales: mantiene la presión aguas abajo de acuerdo al diseño', 'checkbox', 3320),
    ('Rociadores · Trimestral - Válvula reductora de presión de ramales: llave instalada y sin daño', 'checkbox', 3330),
    ('Rociadores · Trimestral - Válvulas de manguera: tapa de manguera debidamente colocada y sin daño', 'checkbox', 3340),
    ('Rociadores · Trimestral - Válvulas de manguera: rosca de manguera sin daño', 'checkbox', 3350),
    ('Rociadores · Trimestral - Válvulas de manguera: llave instalada y sin daño', 'checkbox', 3360),
    ('Rociadores · Trimestral - Válvulas de manguera: los empaques están debidamente colocados', 'checkbox', 3370),
    ('Rociadores · Trimestral - Válvulas de manguera: sin fugas', 'checkbox', 3380),
    ('Rociadores · Trimestral - Válvulas de manguera: sin obstrucción', 'checkbox', 3390),
    ('Rociadores · Trimestral - Manómetros: presión normal del suministro de agua (adjunto)', 'checkbox', 3400),
    ('Rociadores · Semestral - Dispositivo iniciador de señal de supervisión: libres de daño físico', 'checkbox', 3500),
    ('Rociadores · Semestral - Dispositivo iniciador de señal de supervisión: prueba de activación', 'checkbox', 3510),
    ('Rociadores · Semestral - Alarmas de flujo de agua: prueba de flujo', 'checkbox', 3520),
    ('Rociadores · Anual - Dispositivo reguladores de toma de manguera: llave instalada y sin daño', 'checkbox', 3600),
    ('Rociadores · Anual - Dispositivo reguladores de toma de manguera: rosca de manguera sin daño', 'checkbox', 3610),
    ('Rociadores · Anual - Dispositivo reguladores de toma de manguera: sin fugas', 'checkbox', 3620),
    ('Rociadores · Anual - Dispositivo reguladores de toma de manguera: no falta el adaptador de manguera ni la tapa', 'checkbox', 3630),
    ('Rociadores · Anual - Reguladores de soportes de manguera: llave instalada y sin daño', 'checkbox', 3640),
    ('Rociadores · Anual - Reguladores de soportes de manguera: sin fugas', 'checkbox', 3650),
    ('Rociadores · Anual - Válvula de alivio de recirculación: verificar que el agua fluya por la válvula en flujo cero', 'checkbox', 3660),
    ('Rociadores · Anual - Válvula de alivio de presión: verificar que la presión aguas abajo no exceda la presión certificada', 'checkbox', 3670),
    ('Rociadores · Anual - Válvula de alivio de presión: correctamente ajustada y configurada', 'checkbox', 3680),
    ('Rociadores · Anual - Soportes: no deben estar dañados ni desprendidos', 'checkbox', 3690),
    ('Rociadores · Anual - Cartel informativo de diseño hidráulico: colocado, legible y fijado de manera segura', 'checkbox', 3700),
    ('Rociadores · Anual - Tubería y accesorios: libres de daños mecánicos, fugas y corrosión', 'checkbox', 3710),
    ('Rociadores · Anual - Tubería y accesorios: sin cargas externas, sin materiales apoyados ni colgantes', 'checkbox', 3720),
    ('Rociadores · Anual - Rociadores: fugas', 'checkbox', 3730),
    ('Rociadores · Anual - Rociadores: corrosión que perjudica su desempeño', 'checkbox', 3740),
    ('Rociadores · Anual - Rociadores: daño físico', 'checkbox', 3750),
    ('Rociadores · Anual - Rociadores: pérdida de fluido del bulbo', 'checkbox', 3760),
    ('Rociadores · Anual - Rociadores: carga que perjudica el desempeño', 'checkbox', 3770),
    ('Rociadores · Anual - Rociadores: pintura que no sea del fabricante', 'checkbox', 3780),
    ('Rociadores · Anual - Rociadores: orientación correcta', 'checkbox', 3790),
    ('Rociadores · Anual - Rociadores de repuesto: cantidad y tipo correcto (menos de 300: 6 / 300-1000: 12 / más de 1000: 24)', 'checkbox', 3800),
    ('Rociadores · Anual - Rociadores de repuesto: llave para rociadores', 'checkbox', 3810),
    ('Rociadores · Anual - Rociadores de repuesto: lista de rociadores instalados', 'checkbox', 3820),
    ('Rociadores · Anual - Rociadores y boquilla de pulverización: reemplazo de rociadores que acumulan grasa u otros materiales', 'checkbox', 3830),
    ('Rociadores · Anual - Dispositivo de contra flujo (check valve): prueba de flujo', 'checkbox', 3840),
    ('Rociadores · Anual - Posición y funcionamiento de las válvulas de control: cada válvula puesta en funcionamiento en todo su rango', 'checkbox', 3850),
    ('Rociadores · Anual - Válvula de diluvio: prueba de activación anual', 'checkbox', 3860),
    ('Rociadores · Anual - Válvulas reductoras de presión de ramal: prueba con flujo parcial para mover la válvula de su asiento', 'checkbox', 3870),
    ('Rociadores · Cada 5 años - Rociadores: reemplazo por corrosión o entorno adverso', 'checkbox', 3900),
    ('Rociadores · Cada 5 años - Válvulas de retención: inspección interna, limpieza o reparación', 'checkbox', 3910),
    ('Rociadores · Cada 5 años - Válvulas de alarma: inspección interna, limpieza o reparación', 'checkbox', 3920),
    ('Rociadores · Cada 5 años - Válvulas reductoras de presión: prueba con flujo completo, comparar con pruebas anteriores', 'checkbox', 3930),
    ('Rociadores · Cada 5 años - Conexiones de manguera regulable: prueba de flujo completo, comparar con resultados anteriores', 'checkbox', 3940),
    ('Rociadores · Cada 5 años - Conexiones de soporte de manguera regulable: prueba de flujo completo, comparar con resultados anteriores', 'checkbox', 3950),
    ('Rociadores · Cada 5 años - Conexión de bomberos 150psi (siamesa): prueba hidrostática durante 2 horas', 'checkbox', 3960),
    ('Rociadores · Cada 5 años - Manómetro: prueba con manómetro calibrado, 3% o reemplazo', 'checkbox', 3970)
) AS v(label, item_type, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.template_items ti
   WHERE ti.template_id = 'f8121a9d-47d9-4b8f-b2af-c6c1b21617aa'
     AND ti.label = v.label
);

COMMIT;