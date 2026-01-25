-- ============================================
-- MAPELEC - Visits + Templates + Responses
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.visit_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category category NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visit_templates_name_unique'
  ) THEN
    ALTER TABLE public.visit_templates
    ADD CONSTRAINT visit_templates_name_unique UNIQUE (name);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.visit_templates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  item_type TEXT NOT NULL,
  required BOOLEAN DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'template_items_template_id_label_unique'
  ) THEN
    ALTER TABLE public.template_items
    ADD CONSTRAINT template_items_template_id_label_unique UNIQUE (template_id, label);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'template_items_item_type_check'
  ) THEN
    ALTER TABLE public.template_items
    ADD CONSTRAINT template_items_item_type_check
    CHECK (item_type IN ('checkbox', 'number', 'text'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES public.buildings(id) ON DELETE RESTRICT,
  template_id UUID REFERENCES public.visit_templates(id) ON DELETE RESTRICT,
  scheduled_for DATE NOT NULL,
  status visit_status NOT NULL DEFAULT 'planned',
  assigned_crew_id UUID NULL REFERENCES public.crews(id),
  assigned_tech_user_id UUID NULL REFERENCES auth.users(id),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  completed_by UUID NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.visit_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.visits(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.template_items(id) ON DELETE CASCADE,
  value_text TEXT NULL,
  value_number DOUBLE PRECISION NULL,
  value_bool BOOLEAN NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (visit_id, item_id)
);

-- ============================================
-- TRIGGERS
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_visits_updated_at'
  ) THEN
    CREATE TRIGGER update_visits_updated_at
    BEFORE UPDATE ON public.visits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.visit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_responses ENABLE ROW LEVEL SECURITY;

-- visit_templates
CREATE POLICY "Authenticated users can read visit templates"
  ON public.visit_templates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Ops managers can manage visit templates"
  ON public.visit_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'ops_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'ops_manager'
    )
  );

-- template_items
CREATE POLICY "Authenticated users can read template items"
  ON public.template_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Ops managers can manage template items"
  ON public.template_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'ops_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'ops_manager'
    )
  );

-- visits
CREATE POLICY "Ops managers can manage visits"
  ON public.visits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'ops_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'ops_manager'
    )
  );

CREATE POLICY "Directors can read visits"
  ON public.visits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'director'
    )
  );

CREATE POLICY "Techs can read own visits"
  ON public.visits FOR SELECT
  USING (
    assigned_tech_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'tech'
    )
  );

-- visit_responses
CREATE POLICY "Techs can read own visit responses"
  ON public.visit_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.visits
      WHERE id = visit_id
      AND assigned_tech_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'tech'
    )
  );

CREATE POLICY "Techs can insert own visit responses"
  ON public.visit_responses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.visits
      WHERE id = visit_id
      AND assigned_tech_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'tech'
    )
  );

CREATE POLICY "Techs can update own visit responses"
  ON public.visit_responses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.visits
      WHERE id = visit_id
      AND assigned_tech_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'tech'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.visits
      WHERE id = visit_id
      AND assigned_tech_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role = 'tech'
    )
  );

CREATE POLICY "Ops managers and directors can read visit responses"
  ON public.visit_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND role IN ('ops_manager', 'director')
    )
  );

-- ============================================
-- SEED DATA (DEMO)
-- ============================================

INSERT INTO public.visit_templates (name, category, is_active)
VALUES ('Demo - Pump Check', 'pump', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.visit_templates (name, category, is_active)
VALUES ('Demo - Fire Check', 'fire', true)
ON CONFLICT (name) DO NOTHING;

WITH pump_template AS (
  SELECT id FROM public.visit_templates WHERE name = 'Demo - Pump Check'
),
fire_template AS (
  SELECT id FROM public.visit_templates WHERE name = 'Demo - Fire Check'
)
INSERT INTO public.template_items (template_id, label, item_type, required, sort_order)
SELECT id, 'Pressure OK?', 'checkbox', true, 1 FROM pump_template
UNION ALL
SELECT id, 'PSI', 'number', false, 2 FROM pump_template
UNION ALL
SELECT id, 'Notes', 'text', false, 3 FROM pump_template
UNION ALL
SELECT id, 'Panel OK?', 'checkbox', false, 1 FROM fire_template
UNION ALL
SELECT id, 'Observations', 'text', false, 2 FROM fire_template
ON CONFLICT ON CONSTRAINT template_items_template_id_label_unique DO NOTHING;
