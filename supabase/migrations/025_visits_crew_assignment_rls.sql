begin;

drop policy if exists "Techs can read own visits" on public.visits;
drop policy if exists "Techs can update own visits" on public.visits;

create policy "Techs can read own visits"
on public.visits
for select
using (
  public.get_user_role() = 'tech'
  and (
    assigned_tech_user_id = auth.uid()
    or assigned_crew_id = (
      select home_crew_id from public.profiles where user_id = auth.uid()
    )
  )
);

create policy "Techs can update own visits"
on public.visits
for update
using (
  public.get_user_role() = 'tech'
  and (
    assigned_tech_user_id = auth.uid()
    or (
      assigned_tech_user_id is null
      and assigned_crew_id = (
        select home_crew_id from public.profiles where user_id = auth.uid()
      )
    )
  )
)
with check (
  public.get_user_role() = 'tech'
  and assigned_tech_user_id = auth.uid()
);

commit;
