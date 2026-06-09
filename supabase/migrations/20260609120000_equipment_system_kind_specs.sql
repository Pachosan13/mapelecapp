-- ============================================
-- MAPELEC - Equipment: sistema + tipo + datos de placa (precarga)
-- ============================================
-- Extiende equipment para precarga jerárquica edificio -> sistema -> equipo.
-- Estructura descubierta del Excel plantilla GreenWood (SEMCO, 9-jun-2026).
-- No destructivo: solo agrega columnas; las existentes (manufacturer/model/serial/etc) quedan intactas.

-- Sistema del edificio al que pertenece el equipo (los 8 sistemas A-H del nameplate).
alter table public.equipment
  add column if not exists system text;

-- Tipo de equipo: define qué datos de placa aplican en el formulario.
alter table public.equipment
  add column if not exists kind text;

-- Datos de placa por tipo (heterogéneo, JSONB):
--   bomba:     { hp, voltage, pressure_psi, flow_gpm }
--   panel_control: { starter_type, power, voltage }
--   generador: { kva, kw, current_a, voltage }
alter table public.equipment
  add column if not exists specs jsonb not null default '{}'::jsonb;

comment on column public.equipment.system is 'Sistema del edificio: transferencia_agua_potable | reforzador_agua_potable | contra_incendios | achique_freatico | achique_elevador | achique_pluvial | sanitario | planta_diesel';
comment on column public.equipment.kind is 'Tipo de equipo: bomba | panel_control | generador';
comment on column public.equipment.specs is 'Datos de placa por tipo (JSONB). bomba:{hp,voltage,pressure_psi,flow_gpm} | panel_control:{starter_type,power,voltage} | generador:{kva,kw,current_a,voltage}';

-- Índice para listar equipos por edificio+sistema (vista de activos / precarga).
create index if not exists idx_equipment_building_system on public.equipment(building_id, system);
