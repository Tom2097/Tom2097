-- Of the 13 original candidates in this batch, only 2 are reachable:
-- billing_analytics (lib/analytics/billing-events.ts, called from the live
-- /settings/billing page) and operational_reports (the live /operations
-- page's OperationalReports component, via /api/v1/operations/reports).
-- alert_events/alert_rules, elt_pipelines/elt_run_logs/elt_sync_log,
-- semantic_dimensions/semantic_metrics, scheduled_reports, uploaded_files/
-- analytics (lib/analytics/file-upload.ts), and document_reports all have
-- zero callers anywhere and are deliberately skipped.

CREATE TABLE IF NOT EXISTS billing_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  organization_id UUID NOT NULL,
  user_id UUID,
  plan_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE billing_analytics ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE billing_analytics ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE billing_analytics ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE billing_analytics ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE billing_analytics ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE billing_analytics ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_billing_analytics_org ON billing_analytics(organization_id);

CREATE TABLE IF NOT EXISTS operational_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE operational_reports ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE operational_reports ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE operational_reports ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE operational_reports ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE operational_reports ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}';
ALTER TABLE operational_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_operational_reports_org ON operational_reports(organization_id);

ALTER TABLE billing_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org billing analytics" ON billing_analytics;
CREATE POLICY "Users can view their org billing analytics" ON billing_analytics FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org operational reports" ON operational_reports;
CREATE POLICY "Users can view their org operational reports" ON operational_reports FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
