-- Human-in-the-Loop Orchestration -- Tier 0 (foundation).
--
-- Per the Human-in-the-Loop spec: perceive -> reason -> ask -> act, on top
-- of the event bus + jobs layer added by 20260809000000_event_bus_and_jobs.sql.
-- This migration adds the four core tables. What it deliberately does NOT
-- build yet (see the spec's own tiering, and this session's Tier 0/1/2/3
-- breakdown): the full routing fallback ladder (deputy -> role pool ->
-- escalation manager), multi-channel notification beyond in-app, the
-- learning/recommendation engine, and AI conversation integration. Those
-- depend on real HAR volume (learning) or business decisions only the
-- founder can make (which steps are authority gates, Slack/Teams app
-- model, external-party access) -- building them now would mean guessing.
--
-- workflow_runs is a NEW, separate concept from the existing
-- workflow_executions table (lib/workflows/*, the declarative
-- trigger->action automation engine). That engine runs a fixed action list
-- to completion in one pass and was never meant to pause. workflow_runs
-- here models any multi-step process that can durably pause for a human
-- and resume later -- a different shape, not a duplicate.

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running', -- running | awaiting_human | resumed | escalated | expired | cancelled | completed | failed
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_step_key TEXT,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_org_status ON workflow_runs(organization_id, status);

-- The Human Action Request object (spec section 3). trigger_class is the
-- single most important field per the spec ("the distinction matters more
-- than any other rule in this document") -- capability_gap is a fixable
-- data/confidence gap the learning engine may eventually help reduce;
-- authority_gate is a permanent control a human must always clear. Nothing
-- in this Tier 0 build touches that distinction automatically (there is no
-- learning engine yet), but the column exists so it's recorded correctly
-- from day one rather than retrofitted once there's real history to lose.
CREATE TABLE IF NOT EXISTS human_action_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_key TEXT,
  type TEXT NOT NULL DEFAULT 'approve', -- approve | provide_data | decide | verify | acknowledge
  trigger_class TEXT NOT NULL, -- capability_gap | authority_gate
  reason TEXT NOT NULL,
  context_summary TEXT,
  requested_of TEXT,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_recommendation JSONB,
  triggered_by UUID, -- who/what caused the step to run; cannot equal acted_by (separation of duties)
  assignee_role TEXT, -- one of profiles.role's real values (owner/admin/member/viewer); resolved to assignee_user_id at raise-time
  assignee_user_id UUID,
  priority TEXT NOT NULL DEFAULT 'normal', -- low | normal | high | urgent
  due_at TIMESTAMPTZ,
  sla_hours INT,
  status TEXT NOT NULL DEFAULT 'open', -- open | notified | acted | escalated | expired | cancelled
  channel_used TEXT,
  decision TEXT, -- approve | reject | edit | request_info | delegate | escalate
  reason_given TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,
  acted_by UUID
);
CREATE INDEX IF NOT EXISTS idx_har_org_status ON human_action_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_har_assignee ON human_action_requests(assignee_user_id, status);
CREATE INDEX IF NOT EXISTS idx_har_workflow_run ON human_action_requests(workflow_run_id);

-- Assignment history, including delegation and escalation hops (spec
-- section 4). A HAR's CURRENT assignee lives on human_action_requests
-- itself (the field routing/notification code actually reads); this table
-- is the append-only trail of how it got there.
CREATE TABLE IF NOT EXISTS har_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  har_id UUID NOT NULL REFERENCES human_action_requests(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_role TEXT,
  assigned_user_id UUID,
  assigned_by UUID,
  hop_type TEXT NOT NULL DEFAULT 'initial', -- initial | delegation | escalation | fallback
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_har_assignments_har ON har_assignments(har_id, created_at);

-- Every action taken on a HAR (spec section 6/9) -- append-only, immutable.
-- No UPDATE/DELETE policy is ever granted here, for anyone: corrections are
-- new rows, never edits, per the spec's audit-trail requirement.
CREATE TABLE IF NOT EXISTS har_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  har_id UUID NOT NULL REFERENCES human_action_requests(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL, -- approve | reject | edit | request_info | delegate | escalate
  reason TEXT,
  channel TEXT NOT NULL DEFAULT 'in_app',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_har_actions_har ON har_actions(har_id, created_at);

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_action_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE har_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE har_actions ENABLE ROW LEVEL SECURITY;

-- SELECT-only, org-scoped -- same pattern as domain_events/background_jobs
-- in 20260809000000_event_bus_and_jobs.sql. All writes go through the
-- service-role client from lib/hitl/* after an explicit auth check in the
-- API route, never directly from the browser.
DROP POLICY IF EXISTS "Users can view their org workflow runs" ON workflow_runs;
CREATE POLICY "Users can view their org workflow runs" ON workflow_runs FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org human action requests" ON human_action_requests;
CREATE POLICY "Users can view their org human action requests" ON human_action_requests FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org har assignments" ON har_assignments;
CREATE POLICY "Users can view their org har assignments" ON har_assignments FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org har actions" ON har_actions;
CREATE POLICY "Users can view their org har actions" ON har_actions FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
