-- Second pass: remaining dead-code Analytics/reporting tables (zero live
-- callers), migrated per explicit request. Note "analytics" from the
-- original audit turned out to be a Supabase Storage bucket reference
-- (db.storage.from('analytics') in lib/analytics/file-upload.ts), not a
-- database table -- bootstrapped as a bucket below instead.

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  metric TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT 'gt',
  threshold NUMERIC NOT NULL DEFAULT 0,
  severity TEXT NOT NULL DEFAULT 'info',
  channel TEXT NOT NULL DEFAULT 'notification',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS metric TEXT;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS condition TEXT NOT NULL DEFAULT 'gt';
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS threshold NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info';
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'notification';
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_alert_rules_org_metric ON alert_rules(organization_id, metric);

CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  rule_id UUID,
  metric TEXT,
  actual_value NUMERIC,
  threshold NUMERIC,
  severity TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS rule_id UUID;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS metric TEXT;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS actual_value NUMERIC;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS threshold NUMERIC;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_alert_events_org ON alert_events(organization_id);

CREATE TABLE IF NOT EXISTS elt_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  source_table TEXT NOT NULL,
  target_table TEXT NOT NULL,
  column_map JSONB NOT NULL DEFAULT '{}',
  batch_size INTEGER NOT NULL DEFAULT 100,
  schedule TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'idle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE elt_pipelines ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE elt_pipelines ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE elt_pipelines ADD COLUMN IF NOT EXISTS source_table TEXT;
ALTER TABLE elt_pipelines ADD COLUMN IF NOT EXISTS target_table TEXT;
ALTER TABLE elt_pipelines ADD COLUMN IF NOT EXISTS column_map JSONB NOT NULL DEFAULT '{}';
ALTER TABLE elt_pipelines ADD COLUMN IF NOT EXISTS batch_size INTEGER NOT NULL DEFAULT 100;
ALTER TABLE elt_pipelines ADD COLUMN IF NOT EXISTS schedule TEXT;
ALTER TABLE elt_pipelines ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE elt_pipelines ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
ALTER TABLE elt_pipelines ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE elt_pipelines ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_elt_pipelines_org ON elt_pipelines(organization_id);

CREATE TABLE IF NOT EXISTS elt_run_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  rows_processed INTEGER NOT NULL DEFAULT 0,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT
);
ALTER TABLE elt_run_logs ADD COLUMN IF NOT EXISTS pipeline_id UUID;
ALTER TABLE elt_run_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE elt_run_logs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE elt_run_logs ADD COLUMN IF NOT EXISTS rows_processed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE elt_run_logs ADD COLUMN IF NOT EXISTS rows_inserted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE elt_run_logs ADD COLUMN IF NOT EXISTS rows_updated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE elt_run_logs ADD COLUMN IF NOT EXISTS rows_failed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE elt_run_logs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'running';
ALTER TABLE elt_run_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
CREATE INDEX IF NOT EXISTS idx_elt_run_logs_pipeline ON elt_run_logs(pipeline_id, started_at);

CREATE TABLE IF NOT EXISTS elt_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source_table TEXT NOT NULL,
  target_table TEXT,
  last_sync_at TIMESTAMPTZ,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE elt_sync_log ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE elt_sync_log ADD COLUMN IF NOT EXISTS source_table TEXT;
ALTER TABLE elt_sync_log ADD COLUMN IF NOT EXISTS target_table TEXT;
ALTER TABLE elt_sync_log ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE elt_sync_log ADD COLUMN IF NOT EXISTS rows_inserted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE elt_sync_log ADD COLUMN IF NOT EXISTS rows_updated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE elt_sync_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_elt_sync_log_org_source ON elt_sync_log(organization_id, source_table, created_at);

CREATE TABLE IF NOT EXISTS semantic_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sql_expression TEXT NOT NULL,
  domain TEXT,
  aggregate TEXT NOT NULL DEFAULT 'count',
  dimensions TEXT[] DEFAULT '{}',
  filters JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE semantic_metrics ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE semantic_metrics ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE semantic_metrics ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE semantic_metrics ADD COLUMN IF NOT EXISTS sql_expression TEXT;
ALTER TABLE semantic_metrics ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE semantic_metrics ADD COLUMN IF NOT EXISTS aggregate TEXT NOT NULL DEFAULT 'count';
ALTER TABLE semantic_metrics ADD COLUMN IF NOT EXISTS dimensions TEXT[] DEFAULT '{}';
ALTER TABLE semantic_metrics ADD COLUMN IF NOT EXISTS filters JSONB;
ALTER TABLE semantic_metrics ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE semantic_metrics ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE semantic_metrics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_semantic_metrics_org ON semantic_metrics(organization_id);

CREATE TABLE IF NOT EXISTS semantic_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sql_expression TEXT NOT NULL,
  domain TEXT,
  type TEXT NOT NULL DEFAULT 'string',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE semantic_dimensions ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE semantic_dimensions ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE semantic_dimensions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE semantic_dimensions ADD COLUMN IF NOT EXISTS sql_expression TEXT;
ALTER TABLE semantic_dimensions ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE semantic_dimensions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'string';
ALTER TABLE semantic_dimensions ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE semantic_dimensions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE semantic_dimensions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_semantic_dimensions_org ON semantic_dimensions(organization_id);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  query JSONB NOT NULL DEFAULT '{}',
  schedule_cron TEXT,
  channel TEXT NOT NULL DEFAULT 'email',
  recipients TEXT[] DEFAULT '{}',
  last_sent_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS query JSONB NOT NULL DEFAULT '{}';
ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS schedule_cron TEXT;
ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email';
ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS recipients TEXT[] DEFAULT '{}';
ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_org ON scheduled_reports(organization_id);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID,
  filename TEXT,
  original_filename TEXT,
  file_type TEXT,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT,
  blob_url TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending',
  analysis_type TEXT,
  analysis_result JSONB,
  error_message TEXT
);
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS original_filename TEXT;
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS blob_url TEXT;
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS analysis_type TEXT;
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS analysis_result JSONB;
ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS error_message TEXT;
CREATE INDEX IF NOT EXISTS idx_uploaded_files_org ON uploaded_files(organization_id, uploaded_at);

CREATE TABLE IF NOT EXISTS document_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  document_ids UUID[] DEFAULT '{}',
  report_type TEXT,
  summary TEXT,
  insights JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE document_reports ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE document_reports ADD COLUMN IF NOT EXISTS document_ids UUID[] DEFAULT '{}';
ALTER TABLE document_reports ADD COLUMN IF NOT EXISTS report_type TEXT;
ALTER TABLE document_reports ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE document_reports ADD COLUMN IF NOT EXISTS insights JSONB;
ALTER TABLE document_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_document_reports_org ON document_reports(organization_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('analytics', 'analytics', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE elt_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE elt_run_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE elt_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org alert rules" ON alert_rules;
CREATE POLICY "Users can view their org alert rules" ON alert_rules FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org alert events" ON alert_events;
CREATE POLICY "Users can view their org alert events" ON alert_events FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org elt pipelines" ON elt_pipelines;
CREATE POLICY "Users can view their org elt pipelines" ON elt_pipelines FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org elt run logs" ON elt_run_logs;
CREATE POLICY "Users can view their org elt run logs" ON elt_run_logs FOR SELECT
  USING (pipeline_id IN (SELECT id FROM elt_pipelines WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Users can view their org elt sync log" ON elt_sync_log;
CREATE POLICY "Users can view their org elt sync log" ON elt_sync_log FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org semantic metrics" ON semantic_metrics;
CREATE POLICY "Users can view their org semantic metrics" ON semantic_metrics FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org semantic dimensions" ON semantic_dimensions;
CREATE POLICY "Users can view their org semantic dimensions" ON semantic_dimensions FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org scheduled reports" ON scheduled_reports;
CREATE POLICY "Users can view their org scheduled reports" ON scheduled_reports FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org uploaded files" ON uploaded_files;
CREATE POLICY "Users can view their org uploaded files" ON uploaded_files FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org document reports" ON document_reports;
CREATE POLICY "Users can view their org document reports" ON document_reports FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
