-- Sistema de POZO: sección propia en la plantilla "Mantenimiento – Bombas".
--
-- William, 17-nov-2026: "tengo dos proyectos puntuales que tengo bombas de pozo… PH PIAMONTE y
-- PH Siena… las coloque por mientras como bombas pluviales". Lo que se revisa, dictado por él:
-- estado (operativa / no opera), voltaje y amperaje con la bomba en marcha, alarmas del
-- controlador (sin / con) y arranque automático por demanda de llenado (correcto / falla /
-- no verificado). Los textos de las casillas viven en lib/formatters/checklistLabels.ts.
--
-- Se siembran 4 unidades; lib/bombas/checklistFilter.ts (pozoUnitOf) recorta al nº real de
-- bombas de pozo del edificio. Un edificio sin pozo no ve nada de esto.
--
-- ORDEN: CÓDIGO PRIMERO. Con el código viejo, "Bomba de pozo N" no casa con ningún filtro y
-- saldría en TODOS los edificios.
--
-- Solo INSERT: no toca respuestas. Idempotente. Si el rango de sort_order ya está ocupado por
-- otra sección, aborta sin escribir nada.

do $$
declare
  v_template uuid := 'b474fbb0-b51d-42b0-acb2-dae04f303f32';
begin
  if exists (
    select 1 from template_items
     where template_id = v_template
       and sort_order between 12000000 and 12003999
       and label not like 'Bomba de pozo %'
  ) then
    raise exception 'sort_order 12000000..12003999 ya está en uso por otra sección';
  end if;

  insert into template_items (template_id, label, item_type, required, sort_order)
  select v_template,
         'Bomba de pozo ' || u || ' - ' || c.campo,
         c.item_type, false,
         12000000 + (u - 1) * 1000 + c.idx * 10
    from generate_series(1, 4) as u
         cross join (values
           ('Estado de la bomba',                         'checkbox', 0),
           ('Voltaje con la bomba en marcha (V)',         'number',   1),
           ('Amperaje con la bomba en marcha (A)',        'number',   2),
           ('Alarmas del controlador',                    'checkbox', 3),
           ('Arranque automático por demanda de llenado', 'checkbox', 4)
         ) as c(campo, item_type, idx)
   where not exists (
     select 1 from template_items t
      where t.template_id = v_template
        and t.label = 'Bomba de pozo ' || u || ' - ' || c.campo
   );
end $$;
