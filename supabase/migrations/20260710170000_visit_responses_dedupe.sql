-- ============================================
-- MAPELEC - Limpieza de respuestas duplicadas (una fila por campo).
--
-- Antes de la migración de idempotencia (20260710160000), el autosave append-only
-- acumulaba una fila por cada reintento con señal débil. Prod: 11.348 filas para
-- solo 2.293 combinaciones (visita, ítem) reales → 9.055 duplicados. Una visita de
-- prueba (Da Vinci) tenía 2.012 filas para 98 campos.
--
-- La lectura siempre usó la última por campo, así que ningún reporte/PDF cambia:
-- esto solo borra las copias viejas y aligera la tabla.
--
-- Respaldo completo tomado antes de aplicar (visit_responses-backup-full.json).
-- ============================================

-- 1) Conservar SOLO la respuesta más reciente de cada (visita, ítem).
with ranked as (
  select
    id,
    row_number() over (
      partition by visit_id, item_id
      order by created_at desc, id desc
    ) as rn
  from public.visit_responses
)
delete from public.visit_responses vr
using ranked r
where vr.id = r.id
  and r.rn > 1;

-- 2) Backfill del token determinístico a las filas que sobreviven (ahora únicas por
--    (visita, ítem)). Así, si un campo se vuelve a editar, el upsert cae en ESTA
--    fila en vez de crear una nueva. Debe ir DESPUÉS del dedup (si no, varias filas
--    del mismo campo tomarían el mismo token y violarían el índice único).
update public.visit_responses
set client_token = visit_id::text || ':' || item_id::text
where client_token is null;
