-- ============================================
-- MAPELEC - Autosave idempotente: sin filas duplicadas por reintento.
--
-- Reporte (10-jul): una visita de prueba (williamtech, Da Vinci) con 1000
-- respuestas guardadas; deberían ser ~250. Causa: visit_responses es append-only
-- y, con señal débil, el cliente inserta la respuesta pero NO recibe confirmación
-- (timeout) → el outbox reintenta → inserta la MISMA respuesta otra vez. La lectura
-- (última gana) sigue correcta, pero la tabla se infla y el PDF/reporte se hace
-- más lento.
--
-- Solución: token determinístico "<visit_id>:<item_id>" por campo. Reintentar el
-- mismo campo cae SIEMPRE en la misma fila (upsert ON CONFLICT), así que no duplica.
-- Un cambio de valor del mismo campo actualiza esa fila. Una fila por (visita, ítem).
--
-- ⚠️ ORDEN: este índice va ANTES de desplegar el código de upsert.
--   - El código VIEJO inserta client_token = NULL. En un índice único, Postgres
--     trata los NULL como distintos → no hay unique_violation, sigue funcionando
--     durante la ventana de despliegue.
--   - El código NUEVO hace upsert ON CONFLICT (client_token), que REQUIERE que el
--     índice único ya exista.
-- ============================================

alter table public.visit_responses
  add column if not exists client_token text;

drop index if exists public.uq_visit_responses_client_token;

create unique index uq_visit_responses_client_token
  on public.visit_responses (client_token);

comment on column public.visit_responses.client_token is
  'Token determinístico "<visit_id>:<item_id>" para upsert idempotente del autosave. NULL en filas antiguas (pre-migración) — los NULL son distintos en el índice único.';
