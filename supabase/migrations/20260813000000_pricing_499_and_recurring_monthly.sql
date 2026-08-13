-- Re-price to a single public price point ($499/year or $44.49/month,
-- cancel anytime), replacing the $13,000/$10,000 founding-tier model.
-- Founder confirmed zero real customers are on the old pricing (verified
-- directly: no subscriptions row anywhere has a non-null stripe_subscription_id
-- or locked_price_cents), so this is a clean re-price, not a migration of
-- live subscribers.
--
-- billing_interval was declared NOT NULL DEFAULT 'month' in the original
-- CREATE TABLE IF NOT EXISTS (20260718000000_billing_core_tables.sql), but
-- that statement never ran against the already-existing subscriptions
-- table in production (IF NOT EXISTS on CREATE TABLE is a no-op when the
-- table already exists -- it does not add missing columns). The column has
-- never actually existed here: lib/billing/subscription-lifecycle.ts's
-- getYearlyMilestone() explicitly selects it and has been failing with
-- "column does not exist" (42703) on every call, and the Stripe webhook's
-- checkout.session.completed handler has been failing the same way.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'month';

-- Real recurring Stripe Subscriptions (used for the new monthly plan) can
-- report 'unpaid', 'incomplete_expired', or 'paused' -- statuses the
-- previous constraint (added in 20260904020000, itself already a fix for
-- the same class of bug) didn't anticipate because nothing in this codebase
-- created a real recurring Subscription object yet. 'refunded' is also
-- added: lib/billing/subscription-lifecycle.ts's processRefund() has
-- written that status since before pricing v2 existed, but that whole
-- in-app-cancel path was unreachable dead code until this change (nothing
-- ever set billing_interval = 'month' with a real stripe_subscription_id
-- before now) -- the constraint just never caught it failing.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY['pending', 'active', 'canceled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid', 'paused', 'suspended', 'refunded']));
