-- PH PIAMONTE y PH SIENA: la bomba de pozo y su panel pasan de "Achique pluvial" a "Pozo".
--
-- Inventario según capturas de William del 23-nov-2026 (1:28 p. m.): en cada edificio hay una
-- "Bomba De Pozo" y un "Panel de Control de Bomba de Pozo", ambos en achique_pluvial, y ninguna
-- bomba pluvial de verdad.
--
-- Va DESPUÉS del código y de 20261123190000_sistema_pozo.sql.
--
-- Dos frenos, los dos abortan sin escribir nada:
--  1. Si no son exactamente 4 equipos (2 por edificio), el inventario cambió desde las capturas.
--  2. Si alguna visita de esos edificios ya tiene respuestas en las secciones pluviales: los
--     informes se filtran con el inventario actual y esas respuestas dejarían de salir.
-- Idempotente: si ya están en "pozo", no hace nada.
-- El nombre se compara con los espacios normalizados: en Piamonte es "Bomba  De Pozo" (doble espacio).

do $$
declare
  v_template uuid := 'b474fbb0-b51d-42b0-acb2-dae04f303f32';
  v_edificios uuid[];
  v_pendientes int;
  v_hechos int;
  v_respuestas int;
begin
  select array_agg(id) into v_edificios
    from buildings
   where upper(trim(name)) in ('PH PIAMONTE', 'PH SIENA');

  if coalesce(array_length(v_edificios, 1), 0) <> 2 then
    raise exception 'Esperaba 2 edificios (PH PIAMONTE, PH SIENA), encontré %',
      coalesce(array_length(v_edificios, 1), 0);
  end if;

  select count(*) filter (where system = 'achique_pluvial'),
         count(*) filter (where system = 'pozo')
    into v_pendientes, v_hechos
    from equipment
   where building_id = any (v_edificios)
     and lower(regexp_replace(trim(name), '\s+', ' ', 'g')) in ('bomba de pozo', 'panel de control de bomba de pozo');

  if v_pendientes = 0 and v_hechos = 4 then
    raise notice 'Ya estaban en pozo: nada que hacer';
    return;
  end if;

  if v_pendientes <> 4 then
    raise exception 'Esperaba 4 equipos en achique_pluvial, encontré % (en pozo: %)',
      v_pendientes, v_hechos;
  end if;

  select count(*) into v_respuestas
    from visit_responses r
    join visits v on v.id = r.visit_id
    join template_items t on t.id = r.item_id
   where v.building_id = any (v_edificios)
     and t.template_id = v_template
     and (t.label like 'Bombas sumergibles - Sistema pluvial - %' or t.label like 'Panel pluvial - %')
     and (r.value_bool is not null or r.value_number is not null
          or coalesce(trim(r.value_text), '') <> '');

  if v_respuestas > 0 then
    raise exception 'Hay % respuestas pluviales en visitas de esos edificios: revisar antes de mover',
      v_respuestas;
  end if;

  update equipment
     set system = 'pozo'
   where building_id = any (v_edificios)
     and system = 'achique_pluvial'
     and lower(regexp_replace(trim(name), '\s+', ' ', 'g')) in ('bomba de pozo', 'panel de control de bomba de pozo');
end $$;
