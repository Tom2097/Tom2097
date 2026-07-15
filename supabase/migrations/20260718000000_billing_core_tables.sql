-- Backs the core billing subsystem (lib/billing/*.ts, app/actions/stripe.ts,
-- app/api/v1/billing/*): subscriptions, billing_events, and usage_records
-- are all queried/written extensively but none had a migration. This is
-- what was causing GET /api/v1/billing/usage to 500 -- checkUsageLimits()
-- degrades gracefully when these queries fail, but getUsageStatistics()
-- (fixed alongside this migration) was hard-throwing instead.
-- Defensive (IF NOT EXISTS) throughout, per this repo's established
-- migration convention.

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,
  user_id UUID,
  plan_id TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'trialing',
  billing_interval TEXT NOT NULL DEFAULT 'month',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  razorpay_customer_id TEXT,
  razorpay_subscription_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  provider TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID,
  usage_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_org ON billing_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_org_type_time ON usage_records(organization_id, usage_type, created_at);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org subscription" ON subscriptions;
CREATE POLICY "Users can view their org subscription" ON subscriptions FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org billing events" ON billing_events;
CREATE POLICY "Users can view their org billing events" ON billing_events FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org usage records" ON usage_records;
CREATE POLICY "Users can view their org usage records" ON usage_records FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
