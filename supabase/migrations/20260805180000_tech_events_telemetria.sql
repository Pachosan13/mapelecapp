-- Telemetría de campo (5-ago-2026)
--
-- POR QUÉ EXISTE: hoy se cerraron 6 bugs de la app del técnico —la cola que se
-- atascaba sola, el formulario que se repintaba en blanco, las fotos que se
-- borraban— y TODOS se diagnosticaron leyendo código y mirando capturas que
-- William mandó por WhatsApp. La app no tiene una sola línea de medición: cuando
-- un técnico dice "se queda pegado", no hay con qué contestar.
--
-- Esta tabla responde las preguntas que hoy costaron horas:
--   · ¿cuántos envíos hizo para subir N respuestas?  (hoy fueron 149 para 41)
--   · ¿cuánto tardó en drenar y con cuántos quedó?
--   · ¿qué falló y con qué código?
--
-- ADITIVA: solo CREATE. No toca ni borra nada existente. Ver el runbook para la
-- historia de por qué en esta base eso importa.

create table if not exists public.tech_events (
  id          uuid primary key default gen_random_uuid(),
  visit_id    uuid references public.visits(id) on delete cascade,
  created_by  uuid not null default auth.uid() references auth.users(id),
  event       text not null,
  payload     jsonb not null default '{}'::jsonb,
  -- Reloj del EQUIPO: en un sótano los eventos se guardan y suben minutos
  -- después, así que created_at (servidor) no sirve para reconstruir la secuencia.
  client_ts   timestamptz not null,
  created_at  timestamptz not null default now()
);

comment on table public.tech_events is
  'Telemetría de la app del técnico. Sin PII: ids, contadores y duraciones. Se puede purgar sin consecuencias.';

create index if not exists tech_events_visit_idx  on public.tech_events (visit_id, client_ts desc);
create index if not exists tech_events_fecha_idx  on public.tech_events (created_at desc);
create index if not exists tech_events_tipo_idx   on public.tech_events (event, created_at desc);

alter table public.tech_events enable row level security;

-- El técnico solo escribe lo suyo. No lee nada: esto no es para él.
drop policy if exists "Techs insert own events" on public.tech_events;
create policy "Techs insert own events"
on public.tech_events for insert
to authenticated
with check (created_by = auth.uid());

-- Quien diagnostica es ops. Lectura para ops_manager y director.
drop policy if exists "Ops read events" on public.tech_events;
create policy "Ops read events"
on public.tech_events for select
to authenticated
using (public.get_user_role() in ('ops_manager', 'director'));
