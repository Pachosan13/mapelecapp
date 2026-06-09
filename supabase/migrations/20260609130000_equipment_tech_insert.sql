-- ============================================
-- MAPELEC - Técnico puede mapear equipos en campo (opción B, 9-jun-2026)
-- ============================================
-- Habilita que el TÉCNICO inserte equipos, pero SOLO en edificios donde tiene
-- una visita asignada (mismo patrón de seguridad que las policies de `media`).
-- No puede crear equipos en edificios ajenos.

drop policy if exists "Techs can insert equipment for own-visit buildings" on public.equipment;

create policy "Techs can insert equipment for own-visit buildings"
on public.equipment for insert
with check (
  public.get_user_role() = 'tech'
  and exists (
    select 1
    from public.visits v
    where v.building_id = equipment.building_id
      and v.assigned_tech_user_id = auth.uid()
  )
);
