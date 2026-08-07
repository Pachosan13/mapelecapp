-- Agrega 9 campos a "Bomba contra incendio N" (normada, unidades 1..12) en la plantilla
-- "Mantenimiento – Bombas".
--
-- Contexto (7-ago-2026, WhatsApp con William): se le preguntó qué pide el checklist de una
-- bomba contra incendio y listó campos que el formato no tenía. Textual: "voltajes de las
-- tres lineas L1,L2,L3, Amperajes de las tres lineas L1,L2,L3, presion de aranque, presion
-- de parada, la plomeria, diametros de succion y descarga" · "presion maxima, galones por
-- minuto" · "cadena en la succcion, interruptor de presion, transductor de presion, valvula
-- piloto, valvula de venteo".
--
-- De esos, 9 no existían en NINGUNA parte de la plantilla (verificado campo por campo). El
-- único parecido era "Transductor de presión o switch de presión", y vive solo en la Bomba
-- Jockey, no en la contra incendios.
--
-- Confirmado por él antes de escribir esto:
--   · los 9 van          → "1- confirmado los 9"
--   · tipos              → diámetros, presión máxima y galones por minuto en número; los
--                          otros cinco en sí/no ("2 - correcto asi tal cual…")
--   · SOLO en las normadas → "3- solo van en las normadas". Por eso el prefijo del INSERT es
--                          'Bomba contra incendio N - ' y nunca casa la sección
--                          "Bomba contra incendio (no normada) - ".
--   · lo que ya estaba se queda → "4- si dejalas" (Válvula de alivio, Panel de control ok).
--
-- Lo que NO hace y por qué: no separa diésel de eléctrica. Esa era mi hipótesis y William la
-- descartó — "si es diesel o electrica ambas se les revisa esto", la diferencia vive en el
-- formato de RED HÚMEDA, que ya trae sus dos secciones.
--
-- required = false, como los 982 de 983 ítems de esta plantilla. Un campo nuevo obligatorio
-- ×12 unidades trancaría el cierre de visita de un técnico en un sótano.
--
-- sort_order: cada unidad tiene su bloque y hay hueco hasta la siguiente. En vez de fijar
-- números a mano (los bloques 1-3 van de 10000 en 10000 y los 4-12 de 10 en 10), el paso se
-- calcula del hueco real de cada unidad, así que sigue valiendo si alguien reordena.
--
-- Idempotente: cada INSERT lleva su guard por label. Aditiva, no borra ni renombra nada.
-- visit_responses referencia item_id, así que lo ya respondido no se toca.

do $$
declare
  v_template uuid := 'b474fbb0-b51d-42b0-acb2-dae04f303f32';
  v_campos text[][] := array[
    ['Diámetro de succión',    'number'],
    ['Diámetro de descarga',   'number'],
    ['Presión máxima',         'number'],
    ['Galones por minuto',     'number'],
    ['Cadena en la succión',   'checkbox'],
    ['Interruptor de presión', 'checkbox'],
    ['Transductor de presión', 'checkbox'],
    ['Válvula piloto',         'checkbox'],
    ['Válvula de venteo',      'checkbox']
  ];
  n int;
  i int;
  v_prefijo text;
  v_max int;
  v_siguiente int;
  v_paso int;
  v_label text;
begin
  for n in 1..12 loop
    v_prefijo := 'Bomba contra incendio ' || n || ' - ';

    -- Última posición de esta unidad. Si la unidad no existe, no hay nada que extender.
    select max(sort_order) into v_max
      from template_items
     where template_id = v_template
       and label like v_prefijo || '%';
    if v_max is null then
      continue;
    end if;

    -- Primer sort_order ocupado después de esta unidad (la unidad siguiente, o el Jockey).
    select min(sort_order) into v_siguiente
      from template_items
     where template_id = v_template
       and sort_order > v_max;

    -- Reparte los 9 dentro del hueco dejando margen. Sin siguiente sección, espacio de sobra.
    if v_siguiente is null then
      v_paso := 1000;
    else
      v_paso := greatest(1, (v_siguiente - v_max) / 10);
    end if;

    for i in 1..array_length(v_campos, 1) loop
      v_label := v_prefijo || v_campos[i][1];
      if not exists (
        select 1 from template_items
         where template_id = v_template and label = v_label
      ) then
        insert into template_items (template_id, label, item_type, required, sort_order)
        values (v_template, v_label, v_campos[i][2], false, v_max + i * v_paso);
      end if;
    end loop;
  end loop;
end $$;
