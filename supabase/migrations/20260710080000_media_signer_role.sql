-- ============================================
-- MAPELEC - `media.signer_role`: sacar el rol del firmante de `media.system`
--
-- Problema: las firmas (kind='signature') guardaban el rol de quien firma
-- ('cliente' | 'tecnico') dentro de `media.system`, que es el campo del
-- SISTEMA de la foto ('contra_incendios', 'transferencia_agua_potable'...).
-- Un reporte que agrupe evidencia por sistema cuenta 'cliente' y 'tecnico'
-- como si fueran sistemas de bombeo.
--
-- Solución: columna propia `signer_role`. Se backfillea desde `system` y se
-- limpia `system` en las filas de firma.
--
-- ⚠️ RETROCOMPATIBLE A PROPÓSITO: no se exige `signer_role` en el insert.
-- Si esta migración corre antes de que despliegue el código nuevo, el código
-- viejo sigue insertando firmas con `system` y sin `signer_role` — no rompe
-- la captura en campo. El lector del PDF entiende ambos formatos.
-- El endurecimiento (check estricto) va en una migración posterior, cuando
-- el código nuevo lleve tiempo desplegado.
-- ============================================

alter table public.media
  add column if not exists signer_role text;

-- Solo restringe VALORES, no exige presencia.
alter table public.media
  drop constraint if exists media_signer_role_check;

alter table public.media
  add constraint media_signer_role_check
  check (signer_role is null or signer_role in ('cliente', 'tecnico'));

-- --------------------------------------------
-- Backfill: rol desde `system`, y limpiar `system` en las firmas.
-- Histórico: firma con system null = firma del cliente (así lo asumía el PDF,
-- ver app/api/reports/service-report/route.ts).
-- --------------------------------------------
update public.media
set
  signer_role = case when system = 'tecnico' then 'tecnico' else 'cliente' end,
  system = null
where kind = 'signature'
  and signer_role is null;

-- Las filas que NO son firma jamás deben llevar rol de firmante.
update public.media
set signer_role = null
where kind <> 'signature'
  and signer_role is not null;

comment on column public.media.signer_role is
  'Rol de quien firma. Solo para kind=''signature''. NULL en evidencia y documentos.';

comment on column public.media.system is
  'Sistema al que pertenece la evidencia (contra_incendios, transferencia_agua_potable...). NUNCA el rol del firmante — eso va en signer_role.';
