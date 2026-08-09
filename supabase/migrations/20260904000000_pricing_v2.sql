-- Pricing & Payments Build Spec v1.0 -- the new single-product model:
-- authorize-first at sign-up (zero money taken), trial activates only on
-- confirmation, full charge (or first instalment) fires automatically at
-- trial end. Replaces the old 3-tier starter/professional/enterprise
-- subscription model (founder confirmed: no real customers on it yet, so
-- this is a clean cutover, not a migration of live subscribers).
--
-- Extends the EXISTING subscriptions table rather than replacing it --
-- preserves stripe_customer_id/stripe_subscription_id/razorpay_* and every
-- already-built function that reads this table (dunning, cancellation,
-- the /api/v1/billing/subscription/manage route). cancelled_at is added
-- here because lib/billing/subscription-lifecycle.ts already SELECTs it
-- and it never existed -- that query has been silently failing.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_founding BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS founding_slot INT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS locked_price_cents BIGINT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_mode TEXT; -- 'one_time' | 'split'
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_account_id UUID;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reminder_7d_sent_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS reminder_1d_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  billing_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  invoice_address JSONB, -- null = same as billing_address
  billing_email TEXT NOT NULL, -- company billing email, not a personal address (B2B invoicing)
  vat_gst_id TEXT,
  country TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_org ON billing_accounts(organization_id);
ALTER TABLE subscriptions ADD CONSTRAINT fk_subscriptions_billing_account
  FOREIGN KEY (billing_account_id) REFERENCES billing_accounts(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'stripe' | 'razorpay'
  provider_token TEXT NOT NULL, -- Stripe payment_method id -- never raw card data
  type TEXT NOT NULL, -- 'card' | 'sepa_debit' | 'paypal' | ...
  last4 TEXT,
  exp_month INT,
  exp_year INT,
  is_default BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_methods_org ON payment_methods(organization_id);

-- Sequential, gapless, immutable invoice numbers -- a legal requirement in
-- most jurisdictions. Platform-wide (not per-org): DigiT itself is the one
-- legal seller issuing every invoice.
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number BIGINT NOT NULL UNIQUE,
  subscription_id UUID REFERENCES subscriptions(id),
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  net_cents BIGINT NOT NULL,
  tax_cents BIGINT NOT NULL DEFAULT 0,
  gross_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'issued', -- issued | paid | void
  pdf_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  subscription_id UUID REFERENCES subscriptions(id),
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  method TEXT NOT NULL,
  provider_ref TEXT,
  status TEXT NOT NULL, -- succeeded | failed | pending
  attempt_no INT NOT NULL DEFAULT 1,
  failure_reason TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS instalment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  sequence INT NOT NULL, -- 1-12
  due_date TIMESTAMPTZ NOT NULL,
  amount_cents BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | charged | failed | written_off
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_instalment_seq ON instalment_schedule(subscription_id, sequence);
CREATE INDEX IF NOT EXISTS idx_instalment_due ON instalment_schedule(status, due_date) WHERE status = 'scheduled';

-- The founding-50 counter. Pre-seeded with 50 empty rows; claiming is a
-- single atomic UPDATE ... WHERE slot_no IN (SELECT ... FOR UPDATE SKIP
-- LOCKED) -- same pattern as claim_due_jobs() in
-- 20260809000000_event_bus_and_jobs.sql -- never a read-then-write in
-- application code, so two concurrent conversions can never both claim
-- slot 50. Slots do not recycle (spec's explicit rule): once claimed, a
-- row is never reset to unclaimed even if that subscription later cancels.
CREATE TABLE IF NOT EXISTS founding_slots (
  slot_no INT PRIMARY KEY,
  subscription_id UUID REFERENCES subscriptions(id),
  organization_id UUID,
  claimed_at TIMESTAMPTZ
);
INSERT INTO founding_slots (slot_no)
SELECT generate_series(1, 50)
ON CONFLICT (slot_no) DO NOTHING;

CREATE OR REPLACE FUNCTION claim_founding_slot(p_subscription_id UUID, p_organization_id UUID)
RETURNS INT
LANGUAGE sql
AS $$
  UPDATE founding_slots
  SET subscription_id = p_subscription_id, organization_id = p_organization_id, claimed_at = now()
  WHERE slot_no IN (
    SELECT slot_no FROM founding_slots WHERE subscription_id IS NULL ORDER BY slot_no LIMIT 1 FOR UPDATE SKIP LOCKED
  )
  RETURNING slot_no;
$$;

CREATE TABLE IF NOT EXISTS export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by UUID,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  file_ref TEXT,
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_export_requests_org ON export_requests(organization_id);

ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE instalment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_requests ENABLE ROW LEVEL SECURITY;
-- founding_slots is a platform-wide counter, not tenant data -- service-role
-- only (same pattern as event_job_subscriptions), but the count of
-- remaining slots is public information (shown on the pricing page), so a
-- narrow public SELECT of slot_no/claimed status only (no subscription_id
-- or organization_id) is exposed via a view instead of the raw table.
ALTER TABLE founding_slots ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE VIEW founding_slots_public AS
  SELECT count(*) FILTER (WHERE subscription_id IS NULL) AS slots_remaining,
         count(*) AS slots_total
  FROM founding_slots;
GRANT SELECT ON founding_slots_public TO anon, authenticated;

DROP POLICY IF EXISTS "Users can view their org billing account" ON billing_accounts;
CREATE POLICY "Users can view their org billing account" ON billing_accounts FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org payment methods" ON payment_methods;
CREATE POLICY "Users can view their org payment methods" ON payment_methods FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org invoices" ON invoices;
CREATE POLICY "Users can view their org invoices" ON invoices FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org payments" ON payments;
CREATE POLICY "Users can view their org payments" ON payments FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org instalment schedule" ON instalment_schedule;
CREATE POLICY "Users can view their org instalment schedule" ON instalment_schedule FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org export requests" ON export_requests;
CREATE POLICY "Users can view their org export requests" ON export_requests FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
