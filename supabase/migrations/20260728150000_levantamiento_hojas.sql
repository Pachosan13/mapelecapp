-- ============================================
-- MAPELEC — Bandeja de hojas de levantamiento (`levantamiento_hojas`)
--
-- Contexto (28-jul-2026): William mandó las hojas de mantenimiento de junio
-- escaneadas (247 páginas manuscritas). Leídas con IA, 130 resolvieron solas a
-- un edificio de `buildings` y se cargaron como `equipment`. Las otras ~115 NO
-- se pueden asignar sin un humano:
--
--   * el nombre manuscrito matchea con dos edificios ("Santa maria Village" ->
--     SANTA MARIA FASE 1 o FASE 2),
--   * el edificio no está en la app (SEMCO da servicio a ~300, la app tiene 232),
--   * o la hoja usa un código interno del técnico ("S.M.B.P." = P.H PRIVAL).
--
-- Son 111 nombres distintos: demasiados para resolverlos por WhatsApp de a uno.
-- Esta tabla es la bandeja para que William los resuelva de un golpe desde
-- /ops/levantamiento, eligiendo el edificio de una lista.
--
-- Aditiva: crea una tabla nueva y no toca ninguna existente.
-- ============================================

create table if not exists public.levantamiento_hojas (
  id uuid primary key default gen_random_uuid(),

  -- Página del PDF escaneado. Natural key: evita cargar la misma hoja dos veces.
  archivo text not null unique,
  numero_reporte text,

  -- El nombre del cliente TAL COMO lo escribió el técnico, sin corregir. Es lo
  -- que William necesita ver para reconocer de qué edificio se trata.
  cliente_texto text,
  fecha_hoja text,
  tecnico text,

  -- La lectura completa de la hoja (bombas por sección, notas al margen,
  -- observaciones, confianza). De aquí salen los `equipment` al asignar.
  payload jsonb not null,

  -- Edificios que el matcher propuso, en orden. Solo sugerencia.
  candidatos jsonb not null default '[]'::jsonb,

  -- Se llena cuando alguien la resuelve.
  building_id uuid references public.buildings(id) on delete set null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'asignada', 'descartada')),
  nota text,

  resuelta_por uuid references auth.users(id) on delete set null,
  resuelta_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists levantamiento_hojas_estado_idx
  on public.levantamiento_hojas (estado);
create index if not exists levantamiento_hojas_building_idx
  on public.levantamiento_hojas (building_id);

alter table public.levantamiento_hojas enable row level security;

-- Mismo criterio que `equipment` (016_equipment_rls.sql): el técnico no
-- administra inventario, así que aquí ni lee. Es una herramienta de oficina.
create policy "Ops managers and directors can read levantamiento_hojas"
on public.levantamiento_hojas for select
using (public.get_user_role() in ('ops_manager', 'director'));

create policy "Ops managers and directors can insert levantamiento_hojas"
on public.levantamiento_hojas for insert
with check (public.get_user_role() in ('ops_manager', 'director'));

create policy "Ops managers and directors can update levantamiento_hojas"
on public.levantamiento_hojas for update
using (public.get_user_role() in ('ops_manager', 'director'))
with check (public.get_user_role() in ('ops_manager', 'director'));

create policy "Ops managers and directors can delete levantamiento_hojas"
on public.levantamiento_hojas for delete
using (public.get_user_role() in ('ops_manager', 'director'));
