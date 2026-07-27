-- Bloque "Sistema freático" para el formulario de bombas sumergibles.
--
-- POR QUÉ: el template tiene los subtipos Foso elevador, Sistema pluvial y Sistema
-- sanitario, pero NUNCA tuvo freático — aunque el filtro ya lo contempla
-- (SUBMERSIBLE_SUBTYPE_TO_SYSTEM mapea "Sistema freático" -> achique_freatico) y el
-- dropdown de equipos ya deja registrarlo. Resultado: GreenWood tiene 2 bombas freáticas
-- que hoy NO se pueden inspeccionar en ningún lado.
-- Lo reportó William el 22-jun-2026 ("template dice Pluvial 1/Pluvial 2, real = pluvial
-- + freático") y quedó sin cerrar desde entonces.
--
-- FORMA: calcado ítem por ítem del bloque "Sistema sanitario" (28 ítems: 2 bombas con
-- voltajes/amperajes/contactor/térmica/check valve/sensores + estado del foso + panel de
-- control), que es el que William validó en junio. sort_order = el del sanitario + 100
-- (rango 1001-1066, verificado libre) para que quede justo después.
--
-- SEGURIDAD: INSERT puro con guarda NOT EXISTS por (template_id, label). No borra ni
-- actualiza nada -> seguro aunque haya visitas abiertas, porque visit_responses enlaza
-- por item_id (FK), nunca por label. Reejecutable sin efecto.
--
-- EFECTO CONOCIDO: los edificios SIN levantamiento (209 de 231 al 27-jul) no pasan por el
-- filtro de inventario y verán estos 28 campos como N/A, igual que ya ven el resto del
-- template. En los que SÍ tienen equipos, el bloque sale solo si hay achique_freatico.

INSERT INTO public.template_items (template_id, label, item_type, sort_order, required)
SELECT v.template_id, v.label, v.item_type, v.sort_order, v.required
FROM (VALUES
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 1 - Voltaje L1-L2 (V)', 'number', 1001, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 1 - Voltaje L2-L3 (V)', 'number', 1002, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 1 - Voltaje L1-L3 (V)', 'number', 1003, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 1 - Amperaje L1-L2 (A)', 'number', 1004, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 1 - Amperaje L2-L3 (A)', 'number', 1005, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 1 - Amperaje L1-L3 (A)', 'number', 1006, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 1 - Contactor (A)', 'number', 1007, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 1 - Térmica (A)', 'number', 1008, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 1 - Check valve', 'checkbox', 1009, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 1 - Pruebas sensor de nivel', 'checkbox', 1010, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 1 - Pruebas sensor de desborde', 'checkbox', 1011, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 2 - Voltaje L1-L2 (V)', 'number', 1021, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 2 - Voltaje L2-L3 (V)', 'number', 1022, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 2 - Voltaje L1-L3 (V)', 'number', 1023, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 2 - Amperaje L1-L2 (A)', 'number', 1024, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 2 - Amperaje L2-L3 (A)', 'number', 1025, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 2 - Amperaje L1-L3 (A)', 'number', 1026, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 2 - Contactor (A)', 'number', 1027, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 2 - Térmica (A)', 'number', 1028, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 2 - Check valve', 'checkbox', 1029, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 2 - Pruebas sensor de nivel', 'checkbox', 1030, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Bomba 2 - Pruebas sensor de desborde', 'checkbox', 1031, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Estado del foso', 'checkbox', 1061, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Panel de control - Luces piloto', 'checkbox', 1062, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Panel de control - Supervisor de voltaje', 'checkbox', 1063, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Panel de control - Relay alternador', 'checkbox', 1064, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Panel de control - Mini breaker', 'checkbox', 1065, false),
    ('b474fbb0-b51d-42b0-acb2-dae04f303f32'::uuid, 'Bombas sumergibles - Sistema freático - Freático - Panel de control - Selector de posición', 'checkbox', 1066, false)
) AS v(template_id, label, item_type, sort_order, required)
WHERE NOT EXISTS (
  SELECT 1 FROM public.template_items t
  WHERE t.template_id = v.template_id AND t.label = v.label
);
