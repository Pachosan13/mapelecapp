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
