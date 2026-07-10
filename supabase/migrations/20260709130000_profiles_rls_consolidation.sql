-- ============================================
-- MAPELEC - Consolidación de políticas RLS de `profiles`
--
-- Contexto: en producción existían tres políticas creadas a mano (fuera de
-- toda migración) y una cuarta, `profiles_ops_manager_read_all`, editada a
-- mano de forma que ya no coincide con lo que declara
-- `db/migrations/006_profiles_rls_fix.sql`.
--
-- Estado real en prod al 2026-07-09:
--
--   profiles_self_read              SELECT  public         user_id = auth.uid()
--   profiles_self_update            UPDATE  public         user_id = auth.uid()
--   profiles_self_insert            INSERT  public         user_id = auth.uid()
--   profiles_ops_manager_manage_all ALL     public         ops_manager
--   profiles_ops_manager_read_all   SELECT  public         ops_manager + director  <- driftada
--   profiles_ops_director_read_all  SELECT  public         ops_manager + director  <- a mano, duplicado exacto
--   profiles_ops_read_all           SELECT  authenticated  ops_manager             <- a mano, subconjunto de manage_all
--   profiles_ops_update_all         UPDATE  authenticated  ops_manager             <- a mano, subconjunto de manage_all
--
-- Las políticas RLS se combinan con OR, así que las tres creadas a mano no
-- conceden nada que `manage_all` o la `read_all` driftada no concedan ya.
-- Eliminarlas no cambia el comportamiento de ningún rol.
--
-- Lo que sí importa: la lectura de `profiles` por parte del director hoy
-- depende del drift, no de una migración. Esta migración la vuelve explícita
-- y versionada, para que reaplicar `006` no se la quite en silencio.
--
-- Resultado: 5 políticas, mismos permisos efectivos que hoy, todas en el repo.
-- ============================================

-- --------------------------------------------
-- 1. Fuera las tres creadas a mano (redundantes)
-- --------------------------------------------
drop policy if exists "profiles_ops_read_all" on public.profiles;
drop policy if exists "profiles_ops_update_all" on public.profiles;
drop policy if exists "profiles_ops_director_read_all" on public.profiles;

-- --------------------------------------------
-- 2. La lectura de staff (ops_manager + director) queda en UNA política,
--    con el nombre diciendo lo que hace, y acotada a `authenticated`.
--
--    `get_user_role()` devuelve null para anon, así que restringir el rol
--    de Postgres no cambia el resultado — solo lo hace evidente al leerlo.
-- --------------------------------------------
drop policy if exists "profiles_ops_manager_read_all" on public.profiles;
drop policy if exists "profiles_staff_read_all" on public.profiles;

create policy "profiles_staff_read_all"
on public.profiles for select
to authenticated
using (public.get_user_role() in ('ops_manager', 'director'));

-- --------------------------------------------
-- 3. `manage_all` se recrea idéntica, solo para dejarla versionada acá
--    junto al resto y no depender de la lectura de `006`.
--
--    El director NO obtiene escritura: sigue siendo solo lectura.
-- --------------------------------------------
drop policy if exists "profiles_ops_manager_manage_all" on public.profiles;

create policy "profiles_ops_manager_manage_all"
on public.profiles for all
to authenticated
using (public.get_user_role() = 'ops_manager')
with check (public.get_user_role() = 'ops_manager');
