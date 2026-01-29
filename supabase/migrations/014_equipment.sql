-- ============================================
-- MAPELEC - Equipment inventory per building
-- ============================================

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null,
  equipment_type text not null,
  is_active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_building_id_idx
  on public.equipment (building_id);

create unique index if not exists equipment_building_name_key
  on public.equipment (building_id, name);
