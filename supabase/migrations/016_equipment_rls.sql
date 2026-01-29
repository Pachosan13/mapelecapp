-- ============================================
-- MAPELEC - Equipment RLS
-- ============================================

alter table public.equipment enable row level security;

drop policy if exists "Roles can read equipment" on public.equipment;
drop policy if exists "Ops managers and directors can insert equipment" on public.equipment;
drop policy if exists "Ops managers and directors can update equipment" on public.equipment;

create policy "Roles can read equipment"
on public.equipment for select
using (public.get_user_role() in ('ops_manager', 'director', 'tech'));

create policy "Ops managers and directors can insert equipment"
on public.equipment for insert
with check (public.get_user_role() in ('ops_manager', 'director'));

create policy "Ops managers and directors can update equipment"
on public.equipment for update
using (public.get_user_role() in ('ops_manager', 'director'))
with check (public.get_user_role() in ('ops_manager', 'director'));
