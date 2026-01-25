-- ============================================
-- MAPELEC - Initial Schema Migration
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

-- Role enum
CREATE TYPE role AS ENUM ('tech', 'ops_manager', 'director');

-- Category enum
CREATE TYPE category AS ENUM ('pump', 'fire');

-- Frequency enum
CREATE TYPE frequency AS ENUM ('monthly', 'bimonthly');

-- Visit status enum
CREATE TYPE visit_status AS ENUM ('planned', 'in_progress', 'completed', 'missed');

-- Observation status enum
CREATE TYPE obs_status AS ENUM ('open', 'quoted', 'approved', 'in_progress', 'closed');

-- Emergency status enum
CREATE TYPE emergency_status AS ENUM ('open', 'dispatched', 'resolved');

-- ============================================
-- TABLES
-- ============================================

-- Crews table
CREATE TABLE crews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category category NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role role NOT NULL DEFAULT 'tech',
  primary_category category,
  home_crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buildings table
CREATE TABLE buildings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  service_flags TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_home_crew_id ON profiles(home_crew_id);
CREATE INDEX idx_buildings_created_by ON buildings(created_by);
CREATE INDEX idx_crews_category ON crews(category);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Ops managers and directors can read all profiles
CREATE POLICY "Ops managers and directors can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('ops_manager', 'director')
    )
  );

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ops managers can update all profiles
CREATE POLICY "Ops managers can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role = 'ops_manager'
    )
  );

-- Crews RLS Policies
-- Authenticated users can read crews
CREATE POLICY "Authenticated users can read crews"
  ON crews FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only ops managers can insert/update/delete crews
CREATE POLICY "Ops managers can manage crews"
  ON crews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role = 'ops_manager'
    )
  );

-- Buildings RLS Policies
-- Authenticated users can read buildings
CREATE POLICY "Authenticated users can read buildings"
  ON buildings FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only ops managers can insert/update/delete buildings
CREATE POLICY "Ops managers can manage buildings"
  ON buildings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role = 'ops_manager'
    )
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to automatically create profile when user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role, is_active)
  VALUES (NEW.id, 'tech', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call function when new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- SEED DATA
-- ============================================

-- Insert default crews
INSERT INTO crews (name, category) VALUES
  ('Pump Crew 1', 'pump'),
  ('Pump Crew 2', 'pump'),
  ('Pump Crew 3', 'pump'),
  ('Pump Crew 4', 'pump'),
  ('Fire Crew', 'fire');
