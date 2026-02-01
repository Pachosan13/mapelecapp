-- ============================================
-- MAPELEC - Service reports workflow
-- ============================================

create table if not exists public.service_reports (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  report_date date not null,
  status text not null default 'draft',
  client_summary text null,
  internal_notes text null,
  sent_at timestamptz null,
  sent_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  constraint service_reports_unique_day unique (building_id, report_date)
);

alter table public.service_reports enable row level security;

drop policy if exists "Ops managers and directors can read service reports"
  on public.service_reports;
drop policy if exists "Ops managers and directors can insert service reports"
  on public.service_reports;
drop policy if exists "Ops managers and directors can update service reports"
  on public.service_reports;

create policy "Ops managers and directors can read service reports"
on public.service_reports for select
using (public.get_user_role() in ('ops_manager', 'director'));

create policy "Ops managers can insert service reports"
on public.service_reports for insert
with check (public.get_user_role() = 'ops_manager');

create policy "Ops managers can update service reports"
on public.service_reports for update
using (public.get_user_role() = 'ops_manager')
with check (public.get_user_role() = 'ops_manager');
