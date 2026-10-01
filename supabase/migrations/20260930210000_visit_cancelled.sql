-- Cancelar una visita (pedido de William, 30-sep-2026): cuando el técnico se desvía a un correctivo
-- la visita coordinada quedaba abierta y se acumulaba. Estado nuevo + quién/cuándo/por qué.
-- Aditiva: ningún dato existente cambia. Aplicar ANTES del deploy del código que lee estas columnas.

alter type public.visit_status add value if not exists 'cancelled';

alter table public.visits
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users (id) on delete set null,
  add column if not exists cancel_reason text;
