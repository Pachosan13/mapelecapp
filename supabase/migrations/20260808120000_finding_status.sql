-- Estado de los hallazgos (Fase 2 de la bandeja) — 8-ago-2026
--
-- POR QUÉ EXISTE: la Fase 1 (`/ops/hallazgos`) enseñó las 92 fallas que ya se capturaban
-- y las 15 observaciones con acción vendible. Pero era un reporte: se mira y no se puede
-- hacer nada. Sin estado, William tiene que acordarse de memoria cuáles ya cotizó — que es
-- exactamente el problema que la bandeja venía a resolver, movido un casillero.
--
-- POR QUÉ TABLA APARTE Y NO UNA COLUMNA EN visit_responses:
-- `visit_responses` es append-only e idempotente (upsert por `client_token`, índice único
-- de la migración 20260710160000, que existe porque prod llegó a tener 11.348 filas para
-- 2.293 campos reales). Meterle una columna de workflow a la tabla que el técnico reescribe
-- desde el campo es pedir que un reintento del outbox pise el estado comercial. La respuesta
-- del técnico y la decisión de ops son dos cosas con dueños y ciclos de vida distintos.
--
-- IDENTIDAD = (visit_id, item_id), no el id de la respuesta. Ese par es estable: es el mismo
-- `client_token` con el que el outbox hace upsert. El `id` de `visit_responses` no sirve como
-- ancla — las filas viejas anteriores a `client_token` lo tienen NULL.
--
-- LÍMITE CONOCIDO, a propósito: una observación de texto libre puede traer VARIAS
-- recomendaciones en un solo bloque (THE BLUE BUSINESS CENTER, 6-ago: válvula de pie,
-- dos manómetros, liqueo y limpieza de tanques, todo junto). El estado aplica al bloque
-- entero, no a cada renglón. Partirlas exige que alguien las separe a mano o que un modelo
-- lo haga — ninguna de las dos entra en esta fase. Cuando duela, se parte.
--
-- ADITIVA: solo CREATE. No toca ni una fila existente.

create table if not exists public.finding_status (
  id          uuid primary key default gen_random_uuid(),
  visit_id    uuid not null references public.visits(id) on delete cascade,
  item_id     uuid not null references public.template_items(id) on delete cascade,
  estado      text not null default 'abierto'
              check (estado in ('abierto', 'cotizado', 'aprobado', 'descartado')),
  nota        text,
  updated_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (visit_id, item_id)
);

comment on table public.finding_status is
  'Decisión de ops sobre un hallazgo. La ausencia de fila significa "abierto" — no se siembra nada, se crea al primer clic.';

create index if not exists finding_status_estado_idx on public.finding_status (estado, updated_at desc);
create index if not exists finding_status_visit_idx  on public.finding_status (visit_id);

-- updated_at al día sin depender de que el caller se acuerde.
create or replace function public.touch_finding_status()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_finding_status on public.finding_status;
create trigger trg_touch_finding_status
before update on public.finding_status
for each row execute function public.touch_finding_status();

alter table public.finding_status enable row level security;

-- Leen los que ven la bandeja. El técnico no: esto es decisión comercial, no de campo,
-- y enseñarle "descartado" sobre algo que él reportó desmotiva el reporte.
drop policy if exists "Ops read finding status" on public.finding_status;
create policy "Ops read finding status"
on public.finding_status for select
to authenticated
using (public.get_user_role() in ('ops_manager', 'director'));

-- Escribe SOLO ops_manager. El director es de lectura en toda la app (mismo criterio que
-- /ops/verificacion), y acá con más razón: marcar "cotizado" es un compromiso.
drop policy if exists "Ops manager writes finding status" on public.finding_status;
create policy "Ops manager writes finding status"
on public.finding_status for insert
to authenticated
with check (public.get_user_role() = 'ops_manager');

drop policy if exists "Ops manager updates finding status" on public.finding_status;
create policy "Ops manager updates finding status"
on public.finding_status for update
to authenticated
using (public.get_user_role() = 'ops_manager')
with check (public.get_user_role() = 'ops_manager');
