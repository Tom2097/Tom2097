-- Second pass: migrating the remaining dead-code tables per user request,
-- so nothing from the missing-tables audit is left unmigrated even though
-- these currently have zero live callers.

CREATE TABLE IF NOT EXISTS dunning_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_attempt_at TIMESTAMPTZ
);
ALTER TABLE dunning_attempts ADD COLUMN IF NOT EXISTS subscription_id UUID;
ALTER TABLE dunning_attempts ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE dunning_attempts ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE dunning_attempts ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE dunning_attempts ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE dunning_attempts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE dunning_attempts ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE dunning_attempts ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE dunning_attempts ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_dunning_attempts_subscription ON dunning_attempts(subscription_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_dunning_attempts_org ON dunning_attempts(organization_id);

CREATE TABLE IF NOT EXISTS hitl_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  document_id UUID,
  action_type TEXT NOT NULL,
  proposed_action JSONB NOT NULL DEFAULT '{}',
  confidence NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  threshold NUMERIC NOT NULL DEFAULT 80,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE hitl_reviews ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE hitl_reviews ADD COLUMN IF NOT EXISTS document_id UUID;
ALTER TABLE hitl_reviews ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE hitl_reviews ADD COLUMN IF NOT EXISTS proposed_action JSONB NOT NULL DEFAULT '{}';
ALTER TABLE hitl_reviews ADD COLUMN IF NOT EXISTS confidence NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE hitl_reviews ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE hitl_reviews ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE hitl_reviews ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE hitl_reviews ADD COLUMN IF NOT EXISTS threshold NUMERIC NOT NULL DEFAULT 80;
ALTER TABLE hitl_reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_hitl_reviews_org_status ON hitl_reviews(organization_id, status);

CREATE TABLE IF NOT EXISTS workspace_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  source_workspace TEXT,
  target_workspaces TEXT[] DEFAULT '{}',
  payload JSONB DEFAULT '{}',
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE workspace_events ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE workspace_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE workspace_events ADD COLUMN IF NOT EXISTS source_workspace TEXT;
ALTER TABLE workspace_events ADD COLUMN IF NOT EXISTS target_workspaces TEXT[] DEFAULT '{}';
ALTER TABLE workspace_events ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}';
ALTER TABLE workspace_events ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE workspace_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_workspace_events_org ON workspace_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_workspace_events_correlation ON workspace_events(correlation_id);

ALTER TABLE dunning_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org dunning attempts" ON dunning_attempts;
CREATE POLICY "Users can view their org dunning attempts" ON dunning_attempts FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org hitl reviews" ON hitl_reviews;
CREATE POLICY "Users can view their org hitl reviews" ON hitl_reviews FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org workspace events" ON workspace_events;
CREATE POLICY "Users can view their org workspace events" ON workspace_events FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
