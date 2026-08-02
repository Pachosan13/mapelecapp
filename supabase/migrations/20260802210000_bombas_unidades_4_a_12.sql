-- Quita el techo de 3 unidades por sistema en la plantilla "Mantenimiento – Bombas".
-- Extiende a 12: bombas principales, reforzadoras, contra incendio normadas y jockey.
--
-- Contexto (2-ago-2026, William en campo con Aqua Point): tenía una hoja de OTRA área del
-- mismo PH y la carga lo frenó. La causa de fondo no era la carga sino el formulario: sus
-- secciones por unidad solo llegaban a 3, herencia del papel. Un edificio con 5 reforzadoras
-- solo podía registrar 3 — y "mostrar de menos se pierde en campo". Por eso hasta hoy la
-- salida era PARTIR el edificio por área/torre (METRO VIEW A/B, P.H PRIVAL A/B), que es un
-- rodeo, no una solución.
--
-- Máximo real medido en los 238 edificios al 2-ago: 6 reforzadoras. Se siembra hasta 12 para
-- no volver a tocar esto, igual que se hizo con los ventiladores el 29-jul.
--
-- Cómo funciona: `lib/bombas/checklistFilter.ts` NO tiene ningún tope escrito — recorta con
-- `unidad <= nº de bombas del edificio`. El techo eran únicamente las filas sembradas. Al
-- sembrar 4..12, cada edificio ve exactamente las que tiene y ni una más.
--
-- Seguridad:
--  * ADITIVA — solo INSERT. No borra ni modifica ninguna respuesta de campo.
--    (Las respuestas se anclan a `template_item_id`; acá no se toca ningún id existente.)
--  * El único UPDATE es sobre `sort_order`, para abrir hueco. No afecta respuestas.
--  * IDEMPOTENTE — el re-espaciado tiene guard por magnitud y los INSERT usan NOT EXISTS.
--  * SIN REGRESIÓN — un edificio con 2 reforzadoras sigue viendo 2. Un edificio sin
--    inventario verificado sigue viendo la plantilla completa (regla del 28-jul).
--
-- Layout de sort_order: se re-espacia ×10000 para abrir hueco entre grupos contiguos
-- (el más apretado era reforzadora 3 → tablero reforzador, que estaban pegados en 590/591).

do $$
declare
  v_template uuid := 'b474fbb0-b51d-42b0-acb2-dae04f303f32';
  v_max int;
  v_grupo record;
  n int;
  v_insertados int := 0;
begin
  -- ── 1) Re-espaciar para abrir hueco ────────────────────────────────────────────
  select max(sort_order) into v_max from template_items where template_id = v_template;
  if v_max < 100000 then
    update template_items
       set sort_order = sort_order * 10000
     where template_id = v_template;
    raise notice 'sort_order re-espaciado x10000 (max anterior: %)', v_max;
  else
    raise notice 're-espaciado ya aplicado (max: %), se omite', v_max;
  end if;

  -- ── 2) Clonar la unidad 3 de cada grupo hacia 4..12 ────────────────────────────
  -- Cada grupo declara: el prefijo del label de la unidad 3, y cómo se arma el de la N.
  for v_grupo in
    select * from (values
      ('Bombas principales - Bomba 3 - ', 'Bombas principales - Bomba %s - '),
      ('Bomba reforzadora 3 - ',          'Bomba reforzadora %s - '),
      ('Bomba contra incendio 3 - ',      'Bomba contra incendio %s - '),
      ('Bomba Jockey 3 - ',               'Bomba Jockey %s - ')
    ) as t(prefijo_origen, patron_destino)
  loop
    for n in 4..12 loop
      insert into template_items (template_id, label, item_type, required, sort_order)
      select
        v_template,
        format(v_grupo.patron_destino, n) || substring(src.label from length(v_grupo.prefijo_origen) + 1),
        src.item_type,
        src.required,
        -- Cada unidad nueva arranca justo después de la 3 y avanza de 10 en 10.
        (select max(sort_order) from template_items
          where template_id = v_template and label like v_grupo.prefijo_origen || '%')
          + (n - 3) * 1000
          + row_number() over (order by src.sort_order) * 10
      from template_items src
      where src.template_id = v_template
        and src.label like v_grupo.prefijo_origen || '%'
        and not exists (
          select 1 from template_items dup
           where dup.template_id = v_template
             and dup.label = format(v_grupo.patron_destino, n)
                             || substring(src.label from length(v_grupo.prefijo_origen) + 1)
        );
      get diagnostics v_insertados = row_count;
      if v_insertados > 0 then
        raise notice '  % unidad % → % ítems', v_grupo.prefijo_origen, n, v_insertados;
      end if;
    end loop;
  end loop;
end $$;
