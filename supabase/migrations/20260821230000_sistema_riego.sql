-- Sistema de RIEGO — sección propia en la plantilla "Mantenimiento – Bombas".
--
-- Contexto (21-ago-2026, William): "hay un sistema de riego en 2 proyectos específicos y este
-- es uno… es un nuevo sistema como si fuera un reforzador, entonces no sé cómo hacer para
-- diferenciar este nuevo sistema de Riego". No existía ni el sistema (dropdown del inventario)
-- ni la sección del formato, así que no había dónde registrarlo.
--
-- Qué se revisa, dictado por él: "3 cosas importantes: tanque de presión, la bomba (la mayoría
-- de las veces es una), contactor/térmica". A eso se le suman los voltajes/amperajes/HP y las
-- presiones de arranque y parada, que lleva TODA bomba presurizada de esta plantilla — el
-- riego es un reforzador chico. No lleva sección de tablero aparte: el contactor/térmica va
-- dentro de la bomba, que es donde él lo mira.
--
-- Se siembran 2 unidades aunque casi siempre sea una: la excepción cuesta 11 casillas y el
-- filtro (lib/bombas/checklistFilter.ts → riegoUnitOf) recorta al nº real de bombas de riego
-- que tenga el edificio. Un edificio sin riego no ve nada de esto.
--
-- Rango de sort_order: 11000000..11001100, dentro del hueco libre 10660000..14500000 (entre el
-- fin de las sumergibles y la bomba contra incendio no normada). El espacio contiguo al
-- reforzador está apretado (1200 slots hasta las sumergibles) y no cabe sin re-empacar.
--
-- Seguridad: solo INSERT, CERO DELETE y CERO UPDATE → no toca ninguna respuesta de campo
-- (visit_responses va por item_id). Idempotente: el `where not exists` salta lo ya sembrado.

insert into template_items (template_id, label, item_type, required, sort_order)
select 'b474fbb0-b51d-42b0-acb2-dae04f303f32',
       'Bomba de riego ' || u || ' - ' || c.campo,
       c.item_type, false,
       11000000 + (u - 1) * 1000 + c.idx * 10
from generate_series(1, 2) as u
     cross join (values
       ('Voltaje L1-L2',            'number',   0),
       ('Voltaje L2-L3',            'number',   1),
       ('Voltaje L1-L3',            'number',   2),
       ('Amperaje L1-L2',           'number',   3),
       ('Amperaje L2-L3',           'number',   4),
       ('Amperaje L1-L3',           'number',   5),
       ('Potencia del motor (HP)',  'number',   6),
       ('Presion arranque',         'number',   7),
       ('Presion parada',           'number',   8),
       ('Tanque de presión',        'checkbox', 9),
       ('Contactor/Térmica',        'checkbox', 10)
     ) as c(campo, item_type, idx)
where not exists (
  select 1 from template_items t
  where t.template_id = 'b474fbb0-b51d-42b0-acb2-dae04f303f32'
    and t.label = 'Bomba de riego ' || u || ' - ' || c.campo
);
