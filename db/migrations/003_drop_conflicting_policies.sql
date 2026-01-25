-- ============================================
-- MAPELEC - Drop Conflicting Profiles Policies
-- ============================================
-- Removes legacy policies that still reference profiles and
-- cause RLS recursion.

DROP POLICY IF EXISTS "profiles_admin_read_all" ON profiles;
DROP POLICY IF EXISTS "profiles_self_read" ON profiles;
