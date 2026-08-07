-- Convierte los CUATRO tableros de sección única a por-unidad (1..4) en la plantilla
-- "Mantenimiento – Bombas": Tablero (bombas principales), Tablero reforzador,
-- Panel contra incendios y Panel jockey.
--
-- Contexto (7-ago-2026, WhatsApp con William):
--   · Elite 400 — "en la parte de abajo tienen 4 bombas con 2 paneles diferentes por par…
--     transferencia 1 y 2 con su panel de control, transferencia 3 y 4 con su panel".
--     Cargó "Panel de Control de Bombas Principales" y "…#3 Y #4", y el formato solo le
--     daba UN Tablero.
--   · Elite 500 — "estos son los equipos cargados y correctos pero el formato me descarta
--     algunos como incendio Planta baja jockey Planta baja". Tiene panel de incendios y de
--     jockey en Azotea Y en Planta Baja; salía uno de cada.
--
-- La causa era la misma en los cuatro: el scope guardaba el panel como BOOLEANO
-- (hasPrincipalesPanel, hasReforzadorPanel, hasBciPanel, hasJockeyPanel), así que dos
-- paneles del mismo sistema producían una sola sección y el segundo no tenía dónde
-- registrarse. Mismo patrón que ya se resolvió para reforzadoras (14-jul), bombas de
-- incendio y jockeys (29-jul).
--
-- Por qué hasta 4 y no 12 como las bombas: medido en la base, el máximo real hoy es 2 de
-- cada uno (1 edificio con 2 paneles de principales, 3 con 2 de reforzador, 4 con 2 de
-- incendios, 3 con 2 de jockey). 4 deja el doble de margen sin sembrar cientos de ítems
-- que ningún edificio va a usar. Si aparece uno con 5, es otra migración de tres líneas.
--
-- Incluye el Tablero reforzador aunque William no lo mencionó: la consulta mostró 3
-- edificios con dos paneles de reforzador, o sea el mismo defecto callado.
--
-- Orden: el CÓDIGO VA PRIMERO. `checklistFilter` ya resuelve estos grupos por conteo y
-- trata el label viejo sin numerar como unidad 1, así que entre el deploy y esta migración
-- el comportamiento no cambia.
--
-- Seguridad:
--  * Renombrar la unidad 1 NO toca respuestas de campo: visit_responses referencia item_id.
--  * `like 'Tablero - %'` es literal y NO casa 'Tablero reforzador - %'.
--  * Aditiva para 2..4. Idempotente (guards por label). No borra nada.
--  * El paso de sort_order sale del hueco real hasta la sección siguiente, así que no
--    invade a su vecina aunque alguien haya reordenado.

do $$
declare
  v_template uuid := 'b474fbb0-b51d-42b0-acb2-dae04f303f32';
  v_bases text[] := array['Tablero reforzador','Tablero','Panel contra incendios','Panel jockey'];
  v_base text;
  v_items int;
  v_max int;
  v_siguiente int;
  v_paso int;
  n int;
begin
  foreach v_base in array v_bases loop

    -- 1) La sección sin numerar pasa a ser la unidad 1. Solo corre si aún existe.
    if exists (
      select 1 from template_items
       where template_id = v_template and label like v_base || ' - %'
    ) then
      update template_items
         set label = v_base || ' 1 - ' || substring(label from char_length(v_base || ' - ') + 1)
       where template_id = v_template
         and label like v_base || ' - %';
    end if;

    -- 2) Cuántos ítems tiene la unidad 1, dónde termina y dónde empieza lo siguiente.
    select count(*), max(sort_order) into v_items, v_max
      from template_items
     where template_id = v_template and label like v_base || ' 1 - %';
    if coalesce(v_items, 0) = 0 then
      continue;
    end if;

    select min(sort_order) into v_siguiente
      from template_items
     where template_id = v_template and sort_order > v_max;

    if v_siguiente is null then
      v_paso := 1000;
    else
      -- 3 unidades nuevas × v_items, más un slot de margen.
      v_paso := greatest(1, (v_siguiente - v_max) / (3 * v_items + 1));
    end if;

    -- 3) Clona la unidad 1 hacia 2, 3 y 4 (solo las que falten).
    for n in 2..4 loop
      insert into template_items (template_id, label, item_type, required, sort_order)
      select v_template,
             v_base || ' ' || n || ' - ' || substring(ti.label from char_length(v_base || ' 1 - ') + 1),
             ti.item_type,
             ti.required,
             v_max + ((n - 2) * v_items + row_number() over (order by ti.sort_order)) * v_paso
        from template_items ti
       where ti.template_id = v_template
         and ti.label like v_base || ' 1 - %'
         and not exists (
           select 1 from template_items x
            where x.template_id = v_template
              and x.label = v_base || ' ' || n || ' - ' || substring(ti.label from char_length(v_base || ' 1 - ') + 1)
         );
    end loop;

  end loop;
end $$;
