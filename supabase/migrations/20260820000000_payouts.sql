-- Mirrors real Stripe payout / Razorpay settlement records so the founder
-- console can show actual bank-settlement status (Pending/Scheduled/
-- Completed/Failed). This app never triggers or times a payout -- Stripe
-- and Razorpay move money to the linked bank account on their own schedule;
-- this table is populated by their webhooks and by an on-demand sync against
-- their REST APIs (see lib/billing/payout-sync.ts).
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,
  arrival_date TIMESTAMPTZ,
  failure_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_provider_external ON payouts(provider, external_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
-- No end-user policy -- platform-level financial data, not org-scoped.
-- Written only by the webhook routes and payout-sync via the service-role
-- client, and read only by the founder-gated /api/platform/payouts route
-- (same deny-by-default approach as webhook_events).
REVOKE ALL ON TABLE payouts FROM anon, authenticated;
GRANT ALL ON TABLE payouts TO service_role;
