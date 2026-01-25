create or replace function public.get_user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role::text from public.profiles where user_id = auth.uid() limit 1
$$;

alter table public.profiles enable row level security;

do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_self_read') then
    drop policy "profiles_self_read" on public.profiles;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_self_update') then
    drop policy "profiles_self_update" on public.profiles;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_self_insert') then
    drop policy "profiles_self_insert" on public.profiles;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_ops_manager_read_all') then
    drop policy "profiles_ops_manager_read_all" on public.profiles;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_ops_manager_manage_all') then
    drop policy "profiles_ops_manager_manage_all" on public.profiles;
  end if;
end $$;

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
using (public.get_user_role() = 'ops_manager');

create policy "profiles_ops_manager_manage_all"
on public.profiles for all
using (public.get_user_role() = 'ops_manager')
with check (public.get_user_role() = 'ops_manager');
