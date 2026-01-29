-- ============================================
-- MAPELEC - Buildings systems array
-- ============================================

ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS systems TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'buildings'
      AND column_name = 'category'
  ) THEN
    UPDATE public.buildings
    SET systems = ARRAY[category::text]
    WHERE (systems IS NULL OR array_length(systems, 1) IS NULL)
      AND category IN ('pump', 'fire');
  END IF;
END $$;
