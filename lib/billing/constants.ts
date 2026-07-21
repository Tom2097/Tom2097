// Shared billing constants that need to be importable from contexts that
// can't pull in lib/billing/subscription-lifecycle.ts itself (which is
// marked 'server-only' and therefore can't be imported from any module a
// client-side bundle -- or, as with __tests__/auth-callback.test.ts's jsdom
// environment, a test posing as one -- might ever touch).
//
// TRIAL_DAYS is the single source of truth for trial length: startTrial()
// in subscription-lifecycle.ts uses it, and app/auth/callback/route.ts's
// ensureUserProfile() (which provisions the initial trial subscription
// directly, without calling startTrial()) imports it from here instead of
// re-declaring the same number.
export const TRIAL_DAYS = 7
