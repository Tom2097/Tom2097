-- Backs the "configure" setup wizard (components/digit/setup-wizard.tsx ->
-- /api/v1/configure/save) and the auto-routing pipeline
-- (lib/operational/routing.ts's classifyAndRoute/saveRoutingRules), both of
-- which already query workspaces/organization_settings but neither table
-- had a migration. Defensive (IF NOT EXISTS) throughout, matching the
-- convention established in prior migrations this session.

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  vertical TEXT NOT NULL DEFAULT 'general',
  owner TEXT,
  data_sources TEXT[] DEFAULT '{}',
  auto_classify BOOLEAN NOT NULL DEFAULT TRUE,
  auto_route BOOLEAN NOT NULL DEFAULT TRUE,
  hitl_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_create_tasks BOOLEAN NOT NULL DEFAULT FALSE,
  doc_to_workflow BOOLEAN NOT NULL DEFAULT FALSE,
  team_roles TEXT,
  mfa_enforced BOOLEAN NOT NULL DEFAULT FALSE,
  ip_whitelist BOOLEAN NOT NULL DEFAULT FALSE,
  -- Full wizard formData (including vertical-specific FrameworkPanel fields,
  -- which vary per vertical and aren't worth a column each) for fidelity.
  config JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(organization_id);

-- id IS the organization_id (not a separate PK) -- matches
-- saveRoutingRules()'s `.upsert({ id: organizationId, routing_rules })`
-- and classifyAndRoute()'s `.eq("id", organizationId)` exactly.
CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY,
  routing_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org workspaces" ON workspaces;
CREATE POLICY "Users can view their org workspaces" ON workspaces FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org settings" ON organization_settings;
CREATE POLICY "Users can view their org settings" ON organization_settings FOR SELECT
  USING (id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
