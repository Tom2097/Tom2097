-- subscriptions_status_check only allowed active/canceled/past_due/trialing/
-- incomplete -- found by a real insert failing during verification, not by
-- inspection. The new pricing model's state machine (spec section 6,
-- Figure 3: pending -> trialing -> active -> past_due -> suspended, plus
-- cancelled) needs "pending" (the status between sign-up and a confirmed
-- payment method -- spec step 1) and "suspended" (a split payer whose
-- instalment dunning exhausted, spec section 4).
--
-- Note the existing constraint spells the terminal state "canceled" (one L,
-- American spelling) -- matched here for consistency, even though some
-- already-existing billing code elsewhere in this codebase writes
-- "cancelled" (two Ls). That mismatch predates this migration and is a
-- separate latent bug outside this change's scope; not fixed here.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY['pending', 'active', 'canceled', 'past_due', 'trialing', 'incomplete', 'suspended']));
