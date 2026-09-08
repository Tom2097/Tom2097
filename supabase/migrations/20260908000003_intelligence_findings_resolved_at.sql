-- app/api/v1/intelligence/execute/route.ts backs the "Resolve Now" button
-- in components/digit/intelligence-command-center.tsx and has always set
-- resolved_at on resolve, but intelligence_findings
-- (20260628_intelligence_brain.sql) never had that column -- every click
-- 500'd with PGRST204, live and broken on the real AI Intelligence page
-- today (and would have broken the new mobile module's Resolve action too).
ALTER TABLE intelligence_findings ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
