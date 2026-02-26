-- ============================================
-- MAPELEC - Media uploads foundation (RLS + Storage)
-- ============================================

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  visit_id uuid null references public.visits(id) on delete cascade,
  service_report_id uuid null references public.service_reports(id) on delete cascade,
  equipment_id uuid null references public.equipment(id) on delete set null,
  kind text not null default 'evidence',
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  captured_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint media_kind_check check (kind in ('evidence', 'signature', 'document')),
  constraint media_reference_check check (
    visit_id is not null or service_report_id is not null
  )
);

create index if not exists idx_media_building_id on public.media(building_id);
create index if not exists idx_media_visit_id on public.media(visit_id);
create index if not exists idx_media_service_report_id on public.media(service_report_id);
create index if not exists idx_media_equipment_id on public.media(equipment_id);
create index if not exists idx_media_created_at on public.media(created_at desc);

alter table public.media enable row level security;

drop policy if exists "Ops managers and directors can read media" on public.media;
drop policy if exists "Techs can read media from own visits" on public.media;
drop policy if exists "Ops managers can insert media" on public.media;
drop policy if exists "Techs can insert media on own visits" on public.media;
drop policy if exists "Ops managers can update media" on public.media;
drop policy if exists "Ops managers can delete media" on public.media;
drop policy if exists "Techs can delete own media from own visits" on public.media;

create policy "Ops managers and directors can read media"
on public.media for select
using (public.get_user_role() in ('ops_manager', 'director'));

create policy "Techs can read media from own visits"
on public.media for select
using (
  public.get_user_role() = 'tech'
  and visit_id is not null
  and exists (
    select 1
    from public.visits v
    where v.id = media.visit_id
      and (
        v.assigned_tech_user_id = auth.uid()
        or v.assigned_crew_id = (
          select p.home_crew_id
          from public.profiles p
          where p.user_id = auth.uid()
        )
      )
  )
);

create policy "Ops managers can insert media"
on public.media for insert
with check (
  public.get_user_role() = 'ops_manager'
  and exists (
    select 1
    from public.buildings b
    where b.id = media.building_id
  )
);

create policy "Techs can insert media on own visits"
on public.media for insert
with check (
  public.get_user_role() = 'tech'
  and created_by = auth.uid()
  and visit_id is not null
  and service_report_id is null
  and exists (
    select 1
    from public.visits v
    where v.id = media.visit_id
      and v.building_id = media.building_id
      and (
        v.assigned_tech_user_id = auth.uid()
        or v.assigned_crew_id = (
          select p.home_crew_id
          from public.profiles p
          where p.user_id = auth.uid()
        )
      )
  )
);

create policy "Ops managers can update media"
on public.media for update
using (public.get_user_role() = 'ops_manager')
with check (public.get_user_role() = 'ops_manager');

create policy "Ops managers can delete media"
on public.media for delete
using (public.get_user_role() = 'ops_manager');

create policy "Techs can delete own media from own visits"
on public.media for delete
using (
  public.get_user_role() = 'tech'
  and created_by = auth.uid()
  and visit_id is not null
  and exists (
    select 1
    from public.visits v
    where v.id = media.visit_id
      and (
        v.assigned_tech_user_id = auth.uid()
        or v.assigned_crew_id = (
          select p.home_crew_id
          from public.profiles p
          where p.user_id = auth.uid()
        )
      )
  )
);

-- ============================================
-- Supabase Storage bucket + object policies
-- ============================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Roles can read media objects" on storage.objects;
drop policy if exists "Tech and ops can upload media objects" on storage.objects;
drop policy if exists "Ops managers can delete media objects" on storage.objects;
drop policy if exists "Uploaders can delete own media objects" on storage.objects;

create policy "Roles can read media objects"
on storage.objects for select
using (
  bucket_id = 'media'
  and exists (
    select 1
    from public.media m
    where m.storage_path = storage.objects.name
      and (
        public.get_user_role() in ('ops_manager', 'director')
        or (
          public.get_user_role() = 'tech'
          and m.visit_id is not null
          and exists (
            select 1
            from public.visits v
            where v.id = m.visit_id
              and (
                v.assigned_tech_user_id = auth.uid()
                or v.assigned_crew_id = (
                  select p.home_crew_id
                  from public.profiles p
                  where p.user_id = auth.uid()
                )
              )
          )
        )
      )
  )
);

create policy "Tech and ops can upload media objects"
on storage.objects for insert
with check (
  bucket_id = 'media'
  and public.get_user_role() in ('tech', 'ops_manager')
);

create policy "Ops managers can delete media objects"
on storage.objects for delete
using (
  bucket_id = 'media'
  and public.get_user_role() = 'ops_manager'
);

create policy "Uploaders can delete own media objects"
on storage.objects for delete
using (
  bucket_id = 'media'
  and public.get_user_role() = 'tech'
  and owner = auth.uid()
);
