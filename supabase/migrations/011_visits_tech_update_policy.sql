-- Allow techs to update their own visits (start/complete)
drop policy if exists "Techs can update own visits" on public.visits;

create policy "Techs can update own visits"
on public.visits for update
using (
  assigned_tech_user_id = auth.uid()
  and public.get_user_role() = 'tech'
)
with check (
  assigned_tech_user_id = auth.uid()
  and public.get_user_role() = 'tech'
  and status in ('in_progress', 'completed')
);
