-- ============================================
-- MAPELEC - Equipment details fields
-- ============================================

alter table public.equipment
  add column if not exists manufacturer text;

alter table public.equipment
  add column if not exists model text;

alter table public.equipment
  add column if not exists serial text;

alter table public.equipment
  add column if not exists location text;

alter table public.equipment
  add column if not exists tag text;
