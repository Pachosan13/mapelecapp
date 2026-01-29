-- ============================================
-- MAPELEC - Optional equipment link on responses
-- ============================================

alter table public.visit_responses
  add column if not exists equipment_id uuid null
  references public.equipment(id) on delete set null;

create index if not exists visit_responses_equipment_id_idx
  on public.visit_responses (equipment_id);
