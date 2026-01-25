-- ============================================
-- MAPELEC - Fix RLS Recursion Issue
-- ============================================
-- This migration fixes the infinite recursion in RLS policies
-- by using a SECURITY DEFINER function to check user roles

-- Function to get user role without RLS (SECURITY DEFINER bypasses RLS)
-- IMPORTANT: This function must bypass RLS to avoid recursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS role AS $$
DECLARE
  user_role role;
BEGIN
  -- SECURITY DEFINER runs with the privileges of the function owner (postgres)
  -- This allows it to bypass RLS when reading from profiles
  SELECT role INTO user_role
  FROM public.profiles
  WHERE user_id = user_uuid;
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

ALTER FUNCTION public.get_user_role(UUID) OWNER TO postgres;

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Ops managers and directors can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Ops managers can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Ops managers can manage crews" ON crews;
DROP POLICY IF EXISTS "Ops managers can manage buildings" ON buildings;

-- Recreate policies using the SECURITY DEFINER function
-- Ops managers and directors can read all profiles
CREATE POLICY "Ops managers and directors can read all profiles"
  ON profiles FOR SELECT
  USING (
    public.get_user_role(auth.uid()) IN ('ops_manager', 'director')
  );

-- Ops managers can update all profiles
CREATE POLICY "Ops managers can update all profiles"
  ON profiles FOR UPDATE
  USING (
    public.get_user_role(auth.uid()) = 'ops_manager'
  );

-- Only ops managers can insert/update/delete crews
CREATE POLICY "Ops managers can manage crews"
  ON crews FOR ALL
  USING (
    public.get_user_role(auth.uid()) = 'ops_manager'
  );

-- Only ops managers can insert/update/delete buildings
CREATE POLICY "Ops managers can manage buildings"
  ON buildings FOR ALL
  USING (
    public.get_user_role(auth.uid()) = 'ops_manager'
  );
