-- Backs feature flags (lib/feature-flags/admin.ts), the webhook engine
-- (lib/webhooks/engine.ts), and connectors (lib/connectors/engine.ts) --
-- the latter backs the Configure wizard's Step 3 "Data & Integrations"
-- (Gmail/Drive/Slack), which was wired to POST /api/v1/connectors earlier
-- this session. Fully defensive per this repo's established convention:
-- CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS for
-- every column.

CREATE TABLE IF NOT EXISTS global_feature_flags (
  id TEXT PRIMARY KEY DEFAULT 'global',
  flags JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE global_feature_flags ADD COLUMN IF NOT EXISTS flags JSONB NOT NULL DEFAULT '{}';
ALTER TABLE global_feature_flags ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS feature_kill_switches (
  flag TEXT PRIMARY KEY,
  killed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE feature_kill_switches ADD COLUMN IF NOT EXISTS killed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE feature_kill_switches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS feature_flag_canary (
  flag TEXT PRIMARY KEY,
  percent NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE feature_flag_canary ADD COLUMN IF NOT EXISTS percent NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE feature_flag_canary ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS secret TEXT;
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS events TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON webhook_endpoints(organization_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 0,
  status_code INTEGER,
  error TEXT,
  next_retry_at TIMESTAMPTZ,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS endpoint_id UUID;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS status_code INTEGER;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);

CREATE TABLE IF NOT EXISTS connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  credentials JSONB NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS credentials JSONB NOT NULL DEFAULT '{}';
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_connectors_org ON connectors(organization_id);

ALTER TABLE global_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_kill_switches ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_canary ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org webhook endpoints" ON webhook_endpoints;
CREATE POLICY "Users can view their org webhook endpoints" ON webhook_endpoints FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org webhook deliveries" ON webhook_deliveries;
CREATE POLICY "Users can view their org webhook deliveries" ON webhook_deliveries FOR SELECT
  USING (endpoint_id IN (SELECT id FROM webhook_endpoints WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Users can view their org connectors" ON connectors;
CREATE POLICY "Users can view their org connectors" ON connectors FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
