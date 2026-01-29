begin;

drop policy if exists "Techs can read own visits" on public.visits;

create policy "Techs can read own visits"
on public.visits
for select
to public
using (assigned_tech_user_id = auth.uid());

commit;
