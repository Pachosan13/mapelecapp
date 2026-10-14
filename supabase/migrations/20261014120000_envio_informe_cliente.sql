-- Enviar el informe al cliente por correo (pedido de William, 14-oct-2026)
--
-- POR QUÉ EXISTE: desde que SEMCO pasó a la tablet, los informes de red húmeda se han
-- quedado sin enviar (los de bombas William los manda a mano "cuando tiene tiempo"), y un
-- cliente ya reclamó. Con esto el gerente revisa el PDF y lo manda al cliente con un clic.
--
--   · buildings.client_emails → a quién se le manda el informe de cada edificio.
--   · report_sends            → registro de cada envío: a quién, quién lo mandó, cuándo, y
--                               si falló, por qué. Es lo que dice "ya se le mandó".
--
-- ADITIVA: solo agrega una columna con default y una tabla nueva. No toca datos existentes.

alter table public.buildings
  add column if not exists client_emails text[] not null default '{}';

comment on column public.buildings.client_emails is
  'Correos del cliente a los que se envía el informe de mantenimiento de este edificio.';

create table if not exists public.report_sends (
  id          uuid primary key default gen_random_uuid(),
  visit_id    uuid not null references public.visits(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  sent_by     uuid references auth.users(id) on delete set null,
  to_emails   text[] not null,
  subject     text not null,
  status      text not null check (status in ('sent', 'failed')),
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists report_sends_visit_idx on public.report_sends (visit_id, created_at desc);
create index if not exists report_sends_fecha_idx on public.report_sends (created_at desc);

-- Solo el servidor (service role, detrás de la verificación de rol ops_manager/director)
-- lee y escribe esta tabla. Sin políticas: ningún usuario la toca directo.
alter table public.report_sends enable row level security;
