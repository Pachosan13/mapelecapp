-- 027 — Alinear RLS de visit_responses al modelo de CUADRILLA (crew)
--
-- Contexto: las policies de `visits` ya se modernizaron a cuadrilla (025:
-- assigned_tech_user_id = auth.uid() OR assigned_crew_id = home_crew), pero las
-- de `visit_responses` (db/migrations/007) quedaron ancladas SOLO a
-- assigned_tech_user_id. Consecuencia: si un técnico inicia una visita queda
-- "reclamado" como dueño y NINGÚN otro técnico de la misma cuadrilla podía leer
-- ni guardar respuestas de ese informe (aunque sí veía la visita).
--
-- Este cambio permite que CUALQUIER técnico de la cuadrilla asignada continúe el
-- informe empezado por otro (leer las respuestas ya guardadas + guardar las
-- suyas). Reasignar la cuadrilla de la visita reasigna quién puede continuar.
--
-- Idempotente y standalone (drop policy if exists + create).

begin;

drop policy if exists "Techs can read own visit responses" on public.visit_responses;
drop policy if exists "Techs can insert own visit responses" on public.visit_responses;
drop policy if exists "Techs can update own visit responses" on public.visit_responses;

-- SELECT: técnico asignado directo O cualquiera de la cuadrilla asignada
create policy "Techs can read own visit responses"
on public.visit_responses for select
using (
  public.get_user_role() = 'tech'
  and exists (
    select 1 from public.visits v
    where v.id = visit_id
    and (
      v.assigned_tech_user_id = auth.uid()
      or v.assigned_crew_id = (
        select home_crew_id from public.profiles where user_id = auth.uid()
      )
    )
  )
);

-- INSERT: mismo criterio (append-only: cada guardado inserta una fila nueva)
create policy "Techs can insert own visit responses"
on public.visit_responses for insert
with check (
  public.get_user_role() = 'tech'
  and exists (
    select 1 from public.visits v
    where v.id = visit_id
    and (
      v.assigned_tech_user_id = auth.uid()
      or v.assigned_crew_id = (
        select home_crew_id from public.profiles where user_id = auth.uid()
      )
    )
  )
);

-- UPDATE: en la práctica no se usa (append-only), pero se mantiene consistente
create policy "Techs can update own visit responses"
on public.visit_responses for update
using (
  public.get_user_role() = 'tech'
  and exists (
    select 1 from public.visits v
    where v.id = visit_id
    and (
      v.assigned_tech_user_id = auth.uid()
      or v.assigned_crew_id = (
        select home_crew_id from public.profiles where user_id = auth.uid()
      )
    )
  )
)
with check (
  public.get_user_role() = 'tech'
  and exists (
    select 1 from public.visits v
    where v.id = visit_id
    and (
      v.assigned_tech_user_id = auth.uid()
      or v.assigned_crew_id = (
        select home_crew_id from public.profiles where user_id = auth.uid()
      )
    )
  )
);

commit;
