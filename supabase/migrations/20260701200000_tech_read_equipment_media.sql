-- ============================================
-- MAPELEC - Técnicos pueden VER fotos de equipo (feedback William 1-jul)
-- ============================================
-- William: "no sale la foto en perfil de técnico" (sí en gerente). Las fotos de
-- equipo tienen visit_id NULL (atadas al equipo, no a una visita), y la política
-- vieja de técnico solo permitía leer media de SUS visitas → las bloqueaba.
-- Los técnicos YA pueden leer todos los equipos (016_equipment_rls), así que leer
-- sus fotos es consistente. Solo lectura — no suben ni borran fotos de equipo.

-- 1) Lectura de la FILA media (para que listMedia devuelva las fotos del equipo)
drop policy if exists "Techs can read equipment media" on public.media;
create policy "Techs can read equipment media"
on public.media for select
using (
  public.get_user_role() = 'tech'
  and equipment_id is not null
);

-- 2) Lectura del OBJETO en storage (para generar el signed URL y mostrar la imagen).
--    Recrea la política existente sumando el caso equipment_id para técnicos.
drop policy if exists "Roles can read media objects" on storage.objects;
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
          and (
            m.equipment_id is not null
            or (
              m.visit_id is not null
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
      )
  )
);
