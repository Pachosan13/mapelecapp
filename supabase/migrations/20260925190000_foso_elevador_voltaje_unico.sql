-- Bombas del foso del elevador: un solo voltaje y un solo amperaje por bomba.
-- William (SEMCO), 25-sep-2026: son monofásicas, al tomacorriente — "sólo dejar una sola".
--
-- Se RENOMBRA el ítem L1-L2 (conserva su id → su historial) y los L2-L3 / L1-L3 NO se
-- borran: tienen respuestas históricas y template_items → visit_responses es ON DELETE
-- CASCADE. Esos se esconden por código (lib/bombas/checklistFilter.ts → itemRetirado).
-- Código primero: el filtro ya esconde L2-L3/L1-L3 con cualquiera de los dos nombres.
-- Idempotente.

update template_items
   set label = regexp_replace(label, ' - Voltaje L1-L2 \(V\)$', ' - Voltaje (V)')
 where template_id = 'b474fbb0-b51d-42b0-acb2-dae04f303f32'
   and label ~ '^Bombas sumergibles - Foso elevador - Bomba [0-9]+ - Voltaje L1-L2 \(V\)$';

update template_items
   set label = regexp_replace(label, ' - Amperaje L1-L2 \(A\)$', ' - Amperaje (A)')
 where template_id = 'b474fbb0-b51d-42b0-acb2-dae04f303f32'
   and label ~ '^Bombas sumergibles - Foso elevador - Bomba [0-9]+ - Amperaje L1-L2 \(A\)$';

-- Bombas 3 a 6 del foso del elevador. La plantilla solo sembraba 2: P.H. ALEXA tiene 3 en el
-- inventario (y en sitio son 4) y William no tenía dónde registrarlas — "creé 3 bombas pero me
-- salen solo 2… no las guarda" (25-sep). El filtro por inventario ya muestra "Bomba N" solo hasta
-- el nº de bombas `achique_elevador` del edificio. Nacen con el formato monofásico (un voltaje,
-- un amperaje). Layout: Bomba 2 termina en 6300000 y "Estado del foso" está en 6610000; cada
-- unidad usa un bloque de 50000 desde 6310000 (la 6 termina en 6490000).
do $$
declare
  v_template uuid := 'b474fbb0-b51d-42b0-acb2-dae04f303f32';
  n int;
  base int;
begin
  for n in 3..6 loop
    base := 6310000 + (n - 3) * 50000;
    insert into template_items (template_id, label, item_type, required, sort_order)
    select v_template, x.label, x.item_type, false, x.sort_order
      from (values
        ('Bombas sumergibles - Foso elevador - Bomba ' || n || ' - Voltaje (V)', 'number', base),
        ('Bombas sumergibles - Foso elevador - Bomba ' || n || ' - Amperaje (A)', 'number', base + 10000),
        ('Bombas sumergibles - Foso elevador - Bomba ' || n || ' - Check valve', 'checkbox', base + 20000),
        ('Bombas sumergibles - Foso elevador - Bomba ' || n || ' - Pruebas sensor de nivel', 'checkbox', base + 30000)
      ) as x(label, item_type, sort_order)
     where not exists (
       select 1 from template_items t
        where t.template_id = v_template and t.label = x.label
     );
  end loop;
end $$;
