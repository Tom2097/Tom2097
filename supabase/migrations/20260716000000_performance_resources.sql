-- Backs /performance and /resources: the OKR, analytics-events, assets,
-- inventory, resource-booking, and reporting-engine tables/RPCs that
-- lib/analytics/{okr,cohorts,forecasting}.ts, lib/resources/*.ts, and
-- lib/reporting/engine.ts already query/write, but that were never
-- migrated. Defensive (IF NOT EXISTS) throughout -- the migration history
-- in this repo is already known to be out of sync with the live schema.

-- Schema matches the real ingestion path (lib/analytics/engine.ts's
-- trackEvents) exactly -- that function already inserts user_id/
-- event_category/source/session_id, so this table must use those column
-- names rather than the simpler shape the read-side callers alone imply.
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID,
  event_name TEXT NOT NULL,
  event_category TEXT NOT NULL DEFAULT 'general',
  source TEXT NOT NULL DEFAULT 'app',
  session_id TEXT,
  value NUMERIC,
  properties JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_org_event_time ON analytics_events(organization_id, event_name, occurred_at);

-- Both current callers pass '' for p_event/p_category to mean "no filter".
CREATE OR REPLACE FUNCTION analytics_event_timeseries(
  p_org UUID, p_event TEXT, p_category TEXT,
  p_start TIMESTAMPTZ, p_end TIMESTAMPTZ, p_granularity TEXT, p_agg TEXT
) RETURNS TABLE(bucket TIMESTAMPTZ, value NUMERIC) AS $$
  SELECT date_trunc(p_granularity, occurred_at) AS bucket,
    CASE WHEN p_agg = 'sum' THEN SUM(value) ELSE COUNT(*)::NUMERIC END AS value
  FROM analytics_events
  WHERE organization_id = p_org
    AND (p_event = '' OR event_name = p_event)
    AND (p_category = '' OR event_category = p_category)
    AND occurred_at >= p_start AND occurred_at < p_end
  GROUP BY 1
  ORDER BY 1 ASC;
$$ LANGUAGE sql STABLE;

-- p_dimension is not interpolated as a dynamic identifier (SQL injection
-- risk for no benefit) -- only 'event_name' grouping is used today.
CREATE OR REPLACE FUNCTION analytics_event_breakdown(
  p_org UUID, p_event TEXT, p_category TEXT, p_dimension TEXT,
  p_start TIMESTAMPTZ, p_end TIMESTAMPTZ, p_agg TEXT, p_limit INT
) RETURNS TABLE(label TEXT, value NUMERIC) AS $$
  SELECT event_name AS label,
    CASE WHEN p_agg = 'sum' THEN SUM(value) ELSE COUNT(*)::NUMERIC END AS value
  FROM analytics_events
  WHERE organization_id = p_org
    AND (p_event = '' OR event_name = p_event)
    AND (p_category = '' OR event_category = p_category)
    AND occurred_at >= p_start AND occurred_at < p_end
  GROUP BY 1
  ORDER BY 2 DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE;

-- Used by lib/analytics/engine.ts's querySummary(), which
-- lib/reporting/engine.ts's "analytics" report section calls for the
-- default (type: "summary") case -- needed for "Run Report" to work.
CREATE OR REPLACE FUNCTION analytics_event_summary(
  p_org UUID, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ
) RETURNS TABLE(total_events BIGINT, unique_users BIGINT, distinct_events BIGINT, total_value NUMERIC) AS $$
  SELECT COUNT(*) AS total_events,
    COUNT(DISTINCT user_id) AS unique_users,
    COUNT(DISTINCT event_name) AS distinct_events,
    COALESCE(SUM(value), 0) AS total_value
  FROM analytics_events
  WHERE organization_id = p_org AND occurred_at >= p_start AND occurred_at < p_end;
$$ LANGUAGE sql STABLE;

CREATE TABLE IF NOT EXISTS okr_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  owner TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'behind', 'completed')),
  progress NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS okr_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id UUID NOT NULL REFERENCES okr_objectives(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metric TEXT,
  target NUMERIC NOT NULL,
  current NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  weight NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  parent_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  serial_number TEXT,
  asset_tag TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired', 'idle')),
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

-- Minimal -- just enough for getVendorScorecard. A full CRM-domain
-- migration (contacts/deals/etc.) is a separate, larger task.
CREATE TABLE IF NOT EXISTS crm_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  resource_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  booked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sections JSONB NOT NULL DEFAULT '[]',
  range_days INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  definition_id UUID NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'scheduled')),
  range_start TIMESTAMPTZ,
  range_end TIMESTAMPTZ,
  result JSONB,
  error TEXT,
  generated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_okr_objectives_org ON okr_objectives(organization_id);
CREATE INDEX IF NOT EXISTS idx_okr_key_results_objective ON okr_key_results(objective_id);
CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org ON inventory_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_companies_org ON crm_companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_org ON resource_bookings(organization_id);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_resource ON resource_bookings(resource_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_report_definitions_org ON report_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_definition ON report_runs(definition_id);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;

-- Org-scoped RLS, defense-in-depth only (all app access uses the
-- service-role client, which bypasses RLS), mirroring the pattern used for
-- documents/capa_records in earlier migrations.
DROP POLICY IF EXISTS "Users can view their org analytics events" ON analytics_events;
CREATE POLICY "Users can view their org analytics events" ON analytics_events FOR SELECT
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

DROP POLICY IF EXISTS "Users can view their org companies" ON crm_companies;
CREATE POLICY "Users can view their org companies" ON crm_companies FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org bookings" ON resource_bookings;
CREATE POLICY "Users can view their org bookings" ON resource_bookings FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org report definitions" ON report_definitions;
CREATE POLICY "Users can view their org report definitions" ON report_definitions FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org report runs" ON report_runs;
CREATE POLICY "Users can view their org report runs" ON report_runs FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
