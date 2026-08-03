-- app/api/v1/intelligence/briefing/route.ts (GET/POST) reads and writes
-- date, summary, metrics, action_items columns that the version of
-- intelligence_briefings actually live in production never got -- an earlier
-- migration (20260724000000_auth_intelligence_reachable.sql) recreated this
-- table with a much narrower shape (id/organization_id/content/generated_at/
-- created_at only) before this one ever ran, so every GET/POST against this
-- route has been failing with "column does not exist" (surfaced to the user
-- as a 500 on POST). Restores the schema the route has always expected.
ALTER TABLE public.intelligence_briefings ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.intelligence_briefings ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '';
ALTER TABLE public.intelligence_briefings ADD COLUMN IF NOT EXISTS metrics JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.intelligence_briefings ADD COLUMN IF NOT EXISTS action_items JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_intelligence_briefings_org_date ON public.intelligence_briefings(organization_id, date DESC);
