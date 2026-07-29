-- Extiende la plantilla de presurización de escaleras de 4 a 12 ventiladores.
--
-- Contexto (29-jul-2026, pregunta de William en campo): la plantilla solo traía
-- "Ventilador 1..4" sembrados. Un edificio con más de 4 ventiladores no tenía dónde
-- registrarlos — el filtro (lib/bombas/checklistFilter.ts) recorta HACIA ABAJO, no puede
-- crear un "Ventilador 5". La app ancla cada respuesta a un template_item real, así que la
-- única forma de soportar >4 es sembrar más unidades y dejar que el filtro recorte al nº
-- real de cada edificio (mismo patrón que reforzadoras y sumergibles).
--
-- Seguridad:
--  * Aditiva — solo INSERTa filas nuevas; no borra ni modifica respuestas de campo.
--  * Idempotente — el NOT EXISTS evita duplicar si se reaplica; el guard de Entrega también.
--  * Sin regresión — el código YA cambió (deploy primero): sin ventiladores registrados un
--    edificio sigue viendo 4 (DEFAULT_FAN_UNITS), no las 12 sembradas. Las 5..12 solo salen
--    cuando el edificio registra ese nº de ventiladores.
--
-- Layout de sort_order en la plantilla:
--   Datos generales      10..20
--   Ventilador 1        100..400   (31 ítems, paso 10)
--   Ventilador 2        500..800
--   Ventilador 3        900..1200
--   Ventilador 4       1300..1600
--   Entrega            2000..2010   -> se empuja al final para que 5..12 queden antes
--   Ventilador 5       1700..2000
--   Ventilador 6..12   2100..4800

do $$
declare
  v_template uuid := '588ab210-819f-4e93-a903-a863b6cb21b2';
  n int;
begin
  -- 1) Empuja "Entrega" al final para que los ventiladores nuevos queden ANTES de la entrega.
  --    El guard < 100000 hace que reaplicar no lo empuje de nuevo.
  update template_items
     set sort_order = sort_order + 100000
   where template_id = v_template
     and label like 'Entrega%'
     and sort_order < 100000;

  -- 2) Clona la estructura del Ventilador 1 hacia 5..12 (solo los que falten).
  for n in 5..12 loop
    insert into template_items (template_id, label, item_type, required, sort_order)
    select v_template,
           regexp_replace(ti.label, '^Ventilador 1 - ', 'Ventilador ' || n || ' - '),
           ti.item_type,
           ti.required,
           ti.sort_order + (n - 1) * 400
      from template_items ti
     where ti.template_id = v_template
       and ti.label like 'Ventilador 1 - %'
       and not exists (
         select 1
           from template_items t2
          where t2.template_id = v_template
            and t2.label = regexp_replace(ti.label, '^Ventilador 1 - ', 'Ventilador ' || n || ' - ')
       );
  end loop;
end $$;
