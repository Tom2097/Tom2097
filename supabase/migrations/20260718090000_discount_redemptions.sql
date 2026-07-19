-- Fixes three related billing gaps found in the payments audit (task #84):
--
-- 1. lib/billing/discounts.ts held DISCOUNTS (code/maxUses/currentUses) as a
--    module-level in-memory array. currentUses reset to 0 on every cold
--    start/deploy and was never shared across instances, so usage caps were
--    unenforceable. It also incremented currentUses in
--    app/actions/stripe.ts BEFORE the Stripe checkout session existed, so an
--    abandoned checkout still burned a redemption. This migration adds a
--    real discount_codes table plus a discount_redemptions log, and an
--    atomic redeem_discount_code() RPC (claim-then-increment in one
--    UPDATE ... WHERE current_uses < max_uses, so concurrent redemptions
--    can't race past the cap). Application code now only calls this RPC
--    from the Stripe webhook's checkout.session.completed handler, i.e.
--    on confirmed payment.
--
-- 2. app/api/webhooks/stripe/route.ts and the new
--    app/api/webhooks/razorpay/route.ts call claimWebhookEvent()
--    (lib/billing/idempotency.ts) to dedupe webhook deliveries, but the
--    webhook_events ledger table it depends on never had a migration --
--    claimWebhookEvent's insert failed with 42P01 (relation does not
--    exist) and fell through to its fail-open branch, so idempotency was
--    silently never enforced. Added here.
--
-- 3. lib/billing/stripe.ts's handleStripeWebhook and
--    lib/billing/razorpay.ts's handleRazorpayWebhook insert into
--    billing_events with external_id/subscription_id/amount/status/
--    error_message columns that were never added to the table created by
--    20260718000000_billing_core_tables.sql (that migration only wrote
--    organization_id/event_type/provider/metadata). Wiring the Razorpay
--    webhook route up to handleRazorpayWebhook would otherwise fail on
--    every event. Added the missing columns here.
--
-- Defensive (IF NOT EXISTS / DROP POLICY IF EXISTS) throughout, per this
-- repo's established migration convention.

CREATE TABLE IF NOT EXISTS discount_codes (
  code TEXT PRIMARY KEY,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  value NUMERIC NOT NULL,
  max_uses INTEGER NOT NULL,
  current_uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  min_plan_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Redemption log: one row per successfully claimed discount use. The unique
-- constraint on stripe_checkout_session_id means a retried/duplicate
-- checkout.session.completed delivery for the same session can never claim
-- a second redemption, even if it somehow got past the webhook_events
-- dedupe above (defense in depth).
CREATE TABLE IF NOT EXISTS discount_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL REFERENCES discount_codes(code),
  organization_id UUID NOT NULL,
  stripe_checkout_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_redemptions_session
  ON discount_redemptions(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discount_redemptions_org ON discount_redemptions(organization_id);

-- Seed the two founding discount codes previously hardcoded in
-- lib/billing/discounts.ts's DISCOUNTS array. ON CONFLICT DO NOTHING keeps
-- this idempotent and preserves current_uses if the migration is re-run
-- after real redemptions have happened.
INSERT INTO discount_codes (code, discount_type, value, max_uses, expires_at, min_plan_id)
VALUES
  ('FOUNDER30', 'percentage', 30, 20, NOW() + INTERVAL '90 days', 'professional'),
  ('FOUNDER40', 'percentage', 40, 10, NOW() + INTERVAL '90 days', 'enterprise')
ON CONFLICT (code) DO NOTHING;

-- Atomically claim a redemption: increments current_uses only if the code
-- exists, hasn't expired, and is still under max_uses, all in one UPDATE so
-- concurrent callers serialize on the row instead of racing past the cap.
-- Returns zero rows if the code is invalid/expired/exhausted, or if
-- p_session_id was already claimed (caller should treat an empty result as
-- "not claimed").
CREATE OR REPLACE FUNCTION redeem_discount_code(
  p_code TEXT,
  p_organization_id UUID,
  p_session_id TEXT DEFAULT NULL
) RETURNS TABLE(code TEXT, discount_type TEXT, value NUMERIC, min_plan_id TEXT) AS $$
DECLARE
  v_code TEXT;
  v_discount_type TEXT;
  v_value NUMERIC;
  v_min_plan_id TEXT;
BEGIN
  UPDATE discount_codes
  SET current_uses = discount_codes.current_uses + 1,
      updated_at = NOW()
  WHERE upper(discount_codes.code) = upper(p_code)
    AND discount_codes.current_uses < discount_codes.max_uses
    AND (discount_codes.expires_at IS NULL OR discount_codes.expires_at > NOW())
  RETURNING discount_codes.code, discount_codes.discount_type, discount_codes.value, discount_codes.min_plan_id
  INTO v_code, v_discount_type, v_value, v_min_plan_id;

  IF v_code IS NULL THEN
    RETURN;
  END IF;

  -- Log the redemption. If p_session_id was already logged (duplicate
  -- delivery), the unique index raises 23505 -- undo the increment above
  -- and report "not claimed" instead of double-counting.
  BEGIN
    INSERT INTO discount_redemptions (code, organization_id, stripe_checkout_session_id)
    VALUES (v_code, p_organization_id, p_session_id);
  EXCEPTION WHEN unique_violation THEN
    UPDATE discount_codes
    SET current_uses = discount_codes.current_uses - 1,
        updated_at = NOW()
    WHERE discount_codes.code = v_code;
    RETURN;
  END;

  RETURN QUERY SELECT v_code, v_discount_type, v_value, v_min_plan_id;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event
  ON webhook_events(provider, event_id);

ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS subscription_id UUID;
ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Discount codes are just promo-code definitions (no PII); any signed-in
-- user may read them so checkout can validate a code client-side. Writes
-- only ever happen through the service-role client (redeem_discount_code
-- RPC / migrations), which bypasses RLS.
DROP POLICY IF EXISTS "Authenticated users can view discount codes" ON discount_codes;
CREATE POLICY "Authenticated users can view discount codes" ON discount_codes FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view their org discount redemptions" ON discount_redemptions;
CREATE POLICY "Users can view their org discount redemptions" ON discount_redemptions FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- webhook_events is an internal dedupe ledger only ever touched by
-- claimWebhookEvent() via the service-role client; no end-user policy needed.
