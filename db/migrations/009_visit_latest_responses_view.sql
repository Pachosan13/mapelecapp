BEGIN;

CREATE OR REPLACE VIEW public.visit_latest_responses AS
SELECT DISTINCT ON (vr.visit_id, vr.item_id)
  vr.id,
  vr.visit_id,
  vr.item_id,
  vr.value_text,
  vr.value_number,
  vr.value_bool,
  vr.created_at,
  vr.created_by
FROM public.visit_responses vr
ORDER BY vr.visit_id, vr.item_id, vr.created_at DESC;

COMMIT;
