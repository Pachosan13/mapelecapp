-- ============================================
-- MAPELEC - Una firma por (visita, rol). Limpieza + candado.
--
-- Reporte de William (10-jul): "a veces no sale la opción como si se guardó,
-- entonces el técnico la duplica como 5 veces".
-- Realidad en prod: 44 firmas, solo 14 combinaciones (visita, rol) reales.
-- 30 duplicados. Una visita con 13 firmas del cliente.
--
-- Causa: el pad no daba señal de guardado (lienzo sin limpiar, botón sin
-- bloquear) y nada impedía acumular filas.
--
-- ⚠️ ORDEN: esta migración va DESPUÉS de desplegar el código que reemplaza la
-- firma en vez de acumularla. Si el índice único existe antes, el código viejo
-- (que inserta sin borrar) revienta con unique_violation y el técnico no puede
-- firmar en campo.
-- ============================================

-- --------------------------------------------
-- 1. RLS: el técnico debe poder borrar la firma anterior de SU visita para
--    reemplazarla, aunque la haya subido un compañero de cuadrilla.
--    La política existente ("Techs can delete own media from own visits")
--    exige created_by = auth.uid(), lo que bloquea el reemplazo cruzado.
-- --------------------------------------------
drop policy if exists "Techs can replace signatures on own visits" on public.media;

create policy "Techs can replace signatures on own visits"
on public.media for delete
to authenticated
using (
  public.get_user_role() = 'tech'
  and kind = 'signature'
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

-- --------------------------------------------
-- 2. Limpieza: conservar SOLO la firma más reciente de cada (visita, rol).
--
--    El PDF ya usaba la más reciente de cada rol
--    (app/api/reports/service-report/route.ts), así que ningún reporte cambia.
--
--    Los objetos huérfanos del bucket se borran aparte — SQL no los alcanza.
-- --------------------------------------------
with ranked as (
  select
    id,
    row_number() over (
      partition by visit_id, signer_role
      order by created_at desc, id desc
    ) as rn
  from public.media
  where kind = 'signature'
    and visit_id is not null
)
delete from public.media m
using ranked r
where m.id = r.id
  and r.rn > 1;

-- --------------------------------------------
-- 3. El candado. Parcial: solo aplica a firmas de visita.
-- --------------------------------------------
drop index if exists public.media_una_firma_por_visita_y_rol;

create unique index media_una_firma_por_visita_y_rol
  on public.media (visit_id, signer_role)
  where kind = 'signature' and visit_id is not null;

comment on index public.media_una_firma_por_visita_y_rol is
  'Una firma por visita y rol. El guardado REEMPLAZA, no acumula (ver handleSignatureUpload).';
