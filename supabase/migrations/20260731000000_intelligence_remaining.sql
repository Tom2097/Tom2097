-- Second pass: remaining dead-code AI Intelligence tables. All confirmed
-- to have zero live callers by an earlier reachability audit -- the
-- /intelligence page's agent-monitor/causal-graph/predictive-modeling tabs
-- show "coming soon" placeholders instead of rendering the components that
-- would reach this code. Migrated per explicit request to leave nothing
-- from the audit unmigrated.

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT[] DEFAULT '{}',
  workspace_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id);

CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_entity_id TEXT,
  target_entity_type TEXT,
  parameters JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  workspace_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS target_entity_id TEXT;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS target_entity_type TEXT;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '{}';
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS result JSONB;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_agent_actions_agent ON agent_actions(agent_id, created_at);

CREATE TABLE IF NOT EXISTS operational_graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  entity_id TEXT,
  entity_type TEXT,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE operational_graph_nodes ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE operational_graph_nodes ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE operational_graph_nodes ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE operational_graph_nodes ADD COLUMN IF NOT EXISTS properties JSONB DEFAULT '{}';
ALTER TABLE operational_graph_nodes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE operational_graph_nodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_operational_graph_nodes_workspace ON operational_graph_nodes(workspace_id);

-- "from"/"to" are reserved words in SQL, quoted throughout.
CREATE TABLE IF NOT EXISTS operational_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "from" UUID,
  "to" UUID,
  relationship_type TEXT,
  properties JSONB DEFAULT '{}',
  workspace_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE operational_graph_edges ADD COLUMN IF NOT EXISTS "from" UUID;
ALTER TABLE operational_graph_edges ADD COLUMN IF NOT EXISTS "to" UUID;
ALTER TABLE operational_graph_edges ADD COLUMN IF NOT EXISTS relationship_type TEXT;
ALTER TABLE operational_graph_edges ADD COLUMN IF NOT EXISTS properties JSONB DEFAULT '{}';
ALTER TABLE operational_graph_edges ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE operational_graph_edges ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_operational_graph_edges_from ON operational_graph_edges("from");
CREATE INDEX IF NOT EXISTS idx_operational_graph_edges_to ON operational_graph_edges("to");

CREATE TABLE IF NOT EXISTS causal_graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  entity_id TEXT,
  entity_type TEXT,
  event_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE causal_graph_nodes ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE causal_graph_nodes ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE causal_graph_nodes ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE causal_graph_nodes ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE causal_graph_nodes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE causal_graph_nodes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_causal_graph_nodes_workspace ON causal_graph_nodes(workspace_id);

CREATE TABLE IF NOT EXISTS causal_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "from" UUID,
  "to" UUID,
  relationship_type TEXT,
  confidence NUMERIC,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE causal_graph_edges ADD COLUMN IF NOT EXISTS "from" UUID;
ALTER TABLE causal_graph_edges ADD COLUMN IF NOT EXISTS "to" UUID;
ALTER TABLE causal_graph_edges ADD COLUMN IF NOT EXISTS relationship_type TEXT;
ALTER TABLE causal_graph_edges ADD COLUMN IF NOT EXISTS confidence NUMERIC;
ALTER TABLE causal_graph_edges ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE causal_graph_edges ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_causal_graph_edges_from ON causal_graph_edges("from");
CREATE INDEX IF NOT EXISTS idx_causal_graph_edges_to ON causal_graph_edges("to");

CREATE TABLE IF NOT EXISTS correlated_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id TEXT NOT NULL,
  organization_id UUID NOT NULL,
  source TEXT,
  event TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE correlated_events ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE correlated_events ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE correlated_events ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE correlated_events ADD COLUMN IF NOT EXISTS event TEXT;
ALTER TABLE correlated_events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE correlated_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_correlated_events_correlation ON correlated_events(correlation_id, created_at);

CREATE TABLE IF NOT EXISTS datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  file_type TEXT,
  size INTEGER,
  features INTEGER,
  samples INTEGER,
  columns TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS size INTEGER;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS features INTEGER;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS samples INTEGER;
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS columns TEXT[] DEFAULT '{}';
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS created_by UUID;
CREATE INDEX IF NOT EXISTS idx_datasets_org ON datasets(organization_id);

-- References datasets(id) -- must come after datasets is created above.
CREATE TABLE IF NOT EXISTS ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'regression',
  status TEXT NOT NULL DEFAULT 'draft',
  training_data JSONB DEFAULT '{}',
  performance_metrics JSONB,
  deployment_info JSONB,
  hyperparameters JSONB,
  training_logs TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'regression';
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS training_data JSONB DEFAULT '{}';
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS performance_metrics JSONB;
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS deployment_info JSONB;
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS hyperparameters JSONB;
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS training_logs TEXT[] DEFAULT '{}';
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS created_by UUID;
CREATE INDEX IF NOT EXISTS idx_ai_models_org ON ai_models(organization_id);

CREATE TABLE IF NOT EXISTS intelligence_scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  task TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
ALTER TABLE intelligence_scheduled_tasks ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE intelligence_scheduled_tasks ADD COLUMN IF NOT EXISTS task TEXT;
ALTER TABLE intelligence_scheduled_tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE intelligence_scheduled_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE intelligence_scheduled_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_intelligence_scheduled_tasks_org ON intelligence_scheduled_tasks(organization_id, started_at);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE causal_graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE causal_graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE correlated_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_scheduled_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org correlated events" ON correlated_events;
CREATE POLICY "Users can view their org correlated events" ON correlated_events FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org datasets" ON datasets;
CREATE POLICY "Users can view their org datasets" ON datasets FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org ai models" ON ai_models;
CREATE POLICY "Users can view their org ai models" ON ai_models FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org scheduled tasks" ON intelligence_scheduled_tasks;
CREATE POLICY "Users can view their org scheduled tasks" ON intelligence_scheduled_tasks FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
