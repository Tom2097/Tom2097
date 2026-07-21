-- Wiring up the /onboarding industry/goals questionnaire as a real,
-- required step for brand-new signups (app/auth/callback/route.ts,
-- app/(dashboard)/page.tsx) means any profile without
-- profiles.onboarding_completed_at set is now treated as "needs to see
-- /onboarding". Every profile that already existed before that flag had any
-- real meaning attached to it (added by 20260811000000_onboarding_
-- recommendations.sql, but never set by anything until this change) must be
-- backfilled as already-onboarded here -- otherwise every existing customer
-- would get forced into the new questionnaire on their next login.
--
-- One-time backfill: intentionally does not touch rows created after this
-- migration runs, since those are exactly the new signups that should go
-- through onboarding for real.

UPDATE profiles
SET onboarding_completed_at = COALESCE(onboarding_completed_at, created_at, NOW())
WHERE onboarding_completed_at IS NULL;
