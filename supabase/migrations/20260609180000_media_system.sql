-- ============================================
-- SEMCO - Evidencia fotográfica POR SISTEMA (feedback William #7, 9-jun-2026)
-- ============================================
-- Las fotos de evidencia se etiquetan con el sistema del edificio al que pertenecen
-- (transferencia, reforzador, contra incendios, achiques, sanitario, planta diésel)
-- para mostrarlas/agruparlas por sistema en la visita y el informe.

alter table public.media
  add column if not exists system text;

comment on column public.media.system is 'Sistema del edificio al que pertenece la evidencia: transferencia_agua_potable | reforzador_agua_potable | contra_incendios | achique_freatico | achique_elevador | achique_pluvial | sanitario | planta_diesel | null=general';
