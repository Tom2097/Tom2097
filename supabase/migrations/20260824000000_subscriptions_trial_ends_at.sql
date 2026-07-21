-- lib/billing/subscription-lifecycle.ts (startTrial/processTrialEnd/
-- expireTrialIfDue/expireAllDueTrials) has always read and written
-- subscriptions.trial_ends_at, but 20260718000000_billing_core_tables.sql
-- never defined the column -- every trial-related write against a real
-- (non-mocked) database has been silently missing this field. Defensive
-- (IF NOT EXISTS), per this repo's established migration convention.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- app/api/v1/billing/trials/run-due/route.ts sweeps
-- `WHERE status = 'trialing' AND trial_ends_at < now()` on every scheduled
-- run, and lib/auth/server-auth.ts's getAuthenticatedUser() does the
-- equivalent single-row lookup on every authenticated request -- index both
-- columns so neither becomes a full table scan as the subscriptions table
-- grows.
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_trial_ends_at ON subscriptions(status, trial_ends_at);
