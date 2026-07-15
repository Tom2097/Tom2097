-- Backfills 11 tables (plus two documents columns) that should have been
-- created by four earlier migrations this session
-- (20260715000000_operations_action_layer.sql,
-- 20260716000000_performance_resources.sql,
-- 20260717000000_workspaces_and_routing.sql,
-- 20260718000000_billing_core_tables.sql) but weren't -- a live schema
-- check found each of those files only partially applied (some of their
-- CREATE TABLEs succeeded, others silently didn't), leaving Configure
-- (workspace activation), Performance/Resources (OKRs, assets, inventory,
-- bookings), Operations (CAPA, accounts payable, document tasks), and
-- Billing (usage_records) still broken despite being presented as fixed.
--
-- Every table here follows the fully-defensive pattern established after
-- two rounds of "column does not exist" failures on the CRM migration:
-- CREATE TABLE IF NOT EXISTS with the full schema, followed by
-- ALTER TABLE ADD COLUMN IF NOT EXISTS for every column, so a table that
-- already exists elsewhere (full or partial) gets backfilled instead of
-- erroring.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'classification') THEN
    ALTER TABLE documents ADD COLUMN classification TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'extracted_entities') THEN
    ALTER TABLE documents ADD COLUMN extracted_entities JSONB;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS capa_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'minor',
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to UUID,
  sla_deadline TIMESTAMPTZ,
  investigation_notes TEXT,
  action_taken TEXT,
  verification_notes TEXT,
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'minor';
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS investigation_notes TEXT;
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS action_taken TEXT;
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS closed_by UUID;
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE capa_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_capa_records_org ON capa_records(organization_id);

CREATE TABLE IF NOT EXISTS accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  document_id UUID,
  vendor TEXT,
  amount NUMERIC(12, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_review',
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS document_id UUID;
ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_review';
ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS source_id UUID;
ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_accounts_payable_org ON accounts_payable(organization_id);

CREATE TABLE IF NOT EXISTS document_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  task_type TEXT NOT NULL,
  task_id UUID,
  auto_created BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE document_tasks ADD COLUMN IF NOT EXISTS document_id UUID;
ALTER TABLE document_tasks ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE document_tasks ADD COLUMN IF NOT EXISTS task_type TEXT;
ALTER TABLE document_tasks ADD COLUMN IF NOT EXISTS task_id UUID;
ALTER TABLE document_tasks ADD COLUMN IF NOT EXISTS auto_created BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE document_tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE document_tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_document_tasks_document ON document_tasks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tasks_org ON document_tasks(organization_id);

CREATE TABLE IF NOT EXISTS okr_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  owner TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'on_track',
  progress NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'on_track';
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS progress NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE okr_objectives ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_okr_objectives_org ON okr_objectives(organization_id);

CREATE TABLE IF NOT EXISTS okr_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES okr_objectives(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metric TEXT,
  target NUMERIC NOT NULL DEFAULT 0,
  current NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  weight NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS objective_id UUID;
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS metric TEXT;
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS target NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS current NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS weight NUMERIC NOT NULL DEFAULT 1;
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_okr_key_results_objective ON okr_key_results(objective_id);

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  parent_id UUID,
  name TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  serial_number TEXT,
  asset_tag TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  location TEXT,
  purchase_date DATE,
  purchase_value NUMERIC,
  current_value NUMERIC,
  warranty_expiry DATE,
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS parent_id UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_tag TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_value NUMERIC;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS current_value NUMERIC;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_expiry DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(organization_id);

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sku TEXT,
  name TEXT NOT NULL,
  category TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  reorder_point NUMERIC NOT NULL DEFAULT 0,
  eoq NUMERIC,
  unit_cost NUMERIC,
  location TEXT,
  supplier TEXT,
  lead_time_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS quantity NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS reorder_point NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS eoq NUMERIC;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS lead_time_days INTEGER;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_inventory_items_org ON inventory_items(organization_id);

CREATE TABLE IF NOT EXISTS resource_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  resource_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  booked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE resource_bookings ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE resource_bookings ADD COLUMN IF NOT EXISTS resource_id UUID;
ALTER TABLE resource_bookings ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE resource_bookings ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE resource_bookings ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE resource_bookings ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE resource_bookings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE resource_bookings ADD COLUMN IF NOT EXISTS booked_by UUID;
ALTER TABLE resource_bookings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_resource_bookings_org ON resource_bookings(organization_id);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_resource ON resource_bookings(resource_id, start_time, end_time);

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
  config JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS vertical TEXT NOT NULL DEFAULT 'general';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS data_sources TEXT[] DEFAULT '{}';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS auto_classify BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS auto_route BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS hitl_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS auto_create_tasks BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS doc_to_workflow BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS team_roles TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS mfa_enforced BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ip_whitelist BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
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
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS routing_rules JSONB DEFAULT '{}';
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID,
  usage_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS usage_type TEXT;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS quantity NUMERIC NOT NULL DEFAULT 1;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_usage_records_org_type_time ON usage_records(organization_id, usage_type, created_at);

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE capa_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org capa records" ON capa_records;
CREATE POLICY "Users can view their org capa records" ON capa_records FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org payables" ON accounts_payable;
CREATE POLICY "Users can view their org payables" ON accounts_payable FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org document tasks" ON document_tasks;
CREATE POLICY "Users can view their org document tasks" ON document_tasks FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org objectives" ON okr_objectives;
CREATE POLICY "Users can view their org objectives" ON okr_objectives FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org key results" ON okr_key_results;
CREATE POLICY "Users can view their org key results" ON okr_key_results FOR SELECT
  USING (objective_id IN (SELECT id FROM okr_objectives WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Users can view their org assets" ON assets;
CREATE POLICY "Users can view their org assets" ON assets FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org inventory" ON inventory_items;
CREATE POLICY "Users can view their org inventory" ON inventory_items FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org bookings" ON resource_bookings;
CREATE POLICY "Users can view their org bookings" ON resource_bookings FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org workspaces" ON workspaces;
CREATE POLICY "Users can view their org workspaces" ON workspaces FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org settings" ON organization_settings;
CREATE POLICY "Users can view their org settings" ON organization_settings FOR SELECT
  USING (id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org usage records" ON usage_records;
CREATE POLICY "Users can view their org usage records" ON usage_records FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
