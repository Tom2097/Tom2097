-- Every Stripe/Razorpay webhook looks up the owning org by
-- stripe_subscription_id/stripe_customer_id/razorpay_subscription_id/
-- razorpay_customer_id (see app/api/webhooks/stripe/route.ts,
-- lib/billing/razorpay.ts), but only organization_id was ever indexed --
-- these lookups have been full table scans since day one.
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_subscription_id ON subscriptions(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_customer_id ON subscriptions(razorpay_customer_id);
