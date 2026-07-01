-- ============================================
-- MAPELEC - Media por EQUIPO (feedback William 1-jul-2026)
-- ============================================
-- William pidió subir fotos por equipo al mapear ("bomba 1 → esta es la bomba;
-- tablero → estos son los tableros; que se acumulen por cada equipo").
-- La tabla media YA tiene equipment_id, pero el CHECK exigía visit_id o
-- service_report_id → bloqueaba una foto atada SOLO al equipo. Se relaja para
-- permitir también equipment_id como referencia válida. Cambio ADITIVO: no rompe
-- ninguna fila ni flujo existente (los casos visita/informe siguen igual).

alter table public.media drop constraint if exists media_reference_check;

alter table public.media add constraint media_reference_check check (
  visit_id is not null
  or service_report_id is not null
  or equipment_id is not null
);

-- Etiqueta por foto: clasifica la evidencia DENTRO del equipo (placa | vista_general
-- | detalle) para poder cortar la data más fino después (ej. "todas las placas de
-- bombas"). Texto libre nullable a propósito — la UI ofrece las opciones, pero no
-- amarramos un CHECK para poder sumar etiquetas sin otra migración.
alter table public.media add column if not exists label text;
