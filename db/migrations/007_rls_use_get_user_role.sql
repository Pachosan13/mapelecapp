-- ============================================
-- MAPELEC - Use get_user_role() in RLS policies
-- ============================================

create or replace function public.get_user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role::text from public.profiles where user_id = auth.uid() limit 1
$$;

alter function public.get_user_role() owner to postgres;

-- Drop policies that reference profiles via subqueries
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Ops managers and directors can read all profiles" on public.profiles;
drop policy if exists "Ops managers can update all profiles" on public.profiles;
drop policy if exists "profiles_self_read" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
drop policy if exists "profiles_self_insert" on public.profiles;
drop policy if exists "profiles_ops_manager_read_all" on public.profiles;
drop policy if exists "profiles_ops_manager_manage_all" on public.profiles;

drop policy if exists "Ops managers can manage crews" on public.crews;
drop policy if exists "Ops managers can manage buildings" on public.buildings;

drop policy if exists "Ops managers can manage visit templates" on public.visit_templates;
drop policy if exists "Ops managers can manage template items" on public.template_items;
drop policy if exists "Ops managers can manage visits" on public.visits;
drop policy if exists "Directors can read visits" on public.visits;
drop policy if exists "Techs can read own visits" on public.visits;
drop policy if exists "Techs can read own visit responses" on public.visit_responses;
drop policy if exists "Techs can insert own visit responses" on public.visit_responses;
drop policy if exists "Techs can update own visit responses" on public.visit_responses;
drop policy if exists "Ops managers and directors can read visit responses" on public.visit_responses;

-- Profiles policies (no direct profiles subqueries)
create policy "profiles_self_read"
on public.profiles for select
using (user_id = auth.uid());

create policy "profiles_self_update"
on public.profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "profiles_self_insert"
on public.profiles for insert
with check (user_id = auth.uid());

create policy "profiles_ops_manager_read_all"
on public.profiles for select
using (public.get_user_role() in ('ops_manager', 'director'));

create policy "profiles_ops_manager_manage_all"
on public.profiles for all
using (public.get_user_role() = 'ops_manager')
with check (public.get_user_role() = 'ops_manager');

-- Crews policies
create policy "Ops managers can manage crews"
on public.crews for all
using (public.get_user_role() = 'ops_manager');

-- Buildings policies
create policy "Ops managers can manage buildings"
on public.buildings for all
using (public.get_user_role() = 'ops_manager');

-- visit_templates policies
create policy "Ops managers can manage visit templates"
on public.visit_templates for all
using (public.get_user_role() = 'ops_manager')
with check (public.get_user_role() = 'ops_manager');

-- template_items policies
create policy "Ops managers can manage template items"
on public.template_items for all
using (public.get_user_role() = 'ops_manager')
with check (public.get_user_role() = 'ops_manager');

-- visits policies
create policy "Ops managers can manage visits"
on public.visits for all
using (public.get_user_role() = 'ops_manager')
with check (public.get_user_role() = 'ops_manager');

create policy "Directors can read visits"
on public.visits for select
using (public.get_user_role() = 'director');

create policy "Techs can read own visits"
on public.visits for select
using (
  assigned_tech_user_id = auth.uid()
  and public.get_user_role() = 'tech'
);

-- visit_responses policies
create policy "Techs can read own visit responses"
on public.visit_responses for select
using (
  exists (
    select 1 from public.visits
    where id = visit_id
    and assigned_tech_user_id = auth.uid()
  )
  and public.get_user_role() = 'tech'
);

create policy "Techs can insert own visit responses"
on public.visit_responses for insert
with check (
  exists (
    select 1 from public.visits
    where id = visit_id
    and assigned_tech_user_id = auth.uid()
  )
  and public.get_user_role() = 'tech'
);

create policy "Techs can update own visit responses"
on public.visit_responses for update
using (
  exists (
    select 1 from public.visits
    where id = visit_id
    and assigned_tech_user_id = auth.uid()
  )
  and public.get_user_role() = 'tech'
)
with check (
  exists (
    select 1 from public.visits
    where id = visit_id
    and assigned_tech_user_id = auth.uid()
  )
  and public.get_user_role() = 'tech'
);

create policy "Ops managers and directors can read visit responses"
on public.visit_responses for select
using (public.get_user_role() in ('ops_manager', 'director'));
