-- Same bug as intelligence_briefings (fixed in
-- 20260803000000_intelligence_briefings_columns.sql): the original migration
-- (20260628_intelligence_brain.sql) defined a full intelligence_findings
-- schema (type, title, description, impact_score, confidence, entity_id,
-- suggested_action, requires_approval, ...), but a later migration
-- (20260724000000_auth_intelligence_reachable.sql) recreated the table with
-- only id/organization_id/source_module/monetary_risk/status/detected_at
-- before this one ever ran. GET /api/v1/intelligence/findings has been
-- silently returning rows with none of the fields the frontend's Finding
-- interface expects, and the new compliance.notify_capa job handler
-- (lib/compliance/jobs.ts) needs these columns to insert a real finding at
-- all. Restores the schema the code has always expected. id stays UUID
-- (already gen_random_uuid()-backed in production, unlike the original
-- migration's text id) -- only the missing columns are added.
ALTER TABLE public.intelligence_findings ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general';
ALTER TABLE public.intelligence_findings ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.intelligence_findings ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE public.intelligence_findings ADD COLUMN IF NOT EXISTS impact_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE public.intelligence_findings ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE public.intelligence_findings ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE public.intelligence_findings ADD COLUMN IF NOT EXISTS suggested_action TEXT;
ALTER TABLE public.intelligence_findings ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_intelligence_findings_org_status ON public.intelligence_findings(organization_id, status);
