BEGIN;

-- Drop UNIQUE(visit_id,item_id) regardless of generated constraint name
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.visit_responses'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) = 'UNIQUE (visit_id, item_id)';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.visit_responses DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

-- Add created_by for audit (append-only history)
ALTER TABLE public.visit_responses
  ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES auth.users(id);

-- Helpful indexes for latest-per-item queries
CREATE INDEX IF NOT EXISTS visit_responses_visit_item_created_at_idx
  ON public.visit_responses (visit_id, item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS visit_responses_visit_created_at_idx
  ON public.visit_responses (visit_id, created_at DESC);

COMMIT;
