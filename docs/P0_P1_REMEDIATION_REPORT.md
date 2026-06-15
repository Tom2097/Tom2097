# DigiT — P0/P1 Remediation Report

Lead Architect remediation of the audit's P0 (stop-the-bleed security) and P1
(make-the-platform-function) findings. Scope was constrained to: no new
features, no redesign of working modules, preserve existing functionality.

---

## What Was Fixed

### P0.1 — Hardcoded JWT secret removed (CRITICAL)
**File:** `lib/multitenant/context.ts`
- Deleted `const JWT_SECRET = ... || 'your-secret-key'` and the entire `jose`
  `jwtVerify` flow.
- Identity is now derived from the Supabase Auth session, verified server-side
  by `supabase.auth.getUser()`. There is no secret to leak or forge against.
- Verified: `grep` for `your-secret-key` / `jwtVerify` across `app` + `lib`
  returns nothing on the live path.

### P0.3 — Auth middleware now fails closed (MEDIUM)
**File:** `lib/supabase/middleware.ts`
- Previously, missing Supabase env vars caused `updateSession` to return
  `next()` and serve traffic anonymously.
- Now, when auth is unconfigured: `/api/*` returns `503`, and protected pages
  redirect to `/auth/login`. The platform cannot serve protected surfaces
  without a working auth layer.

### P0.2 — AI Assistant endpoint authenticated (HIGH)
**File:** `app/api/chat/route.ts`
- `/api/chat` was fully public (no auth, no scoping) — an open, unmetered LLM
  proxy. It now calls `extractTenantContext()` and returns `401` for
  unauthenticated callers before reaching the model.
- All existing streaming behavior (system prompt, `streamText`, UI message
  stream) is preserved unchanged.

### P1.4 — Frontend and backend now share ONE identity model
**Files:** `lib/multitenant/context.ts`, `proxy.ts`
- The API layer no longer requires a custom `Authorization: Bearer <JWT>` +
  `X-Tenant-ID` header contract that the browser app never produced. It reads
  the same Supabase session cookie the frontend already uses.
- Removed the dead, header-based tenant block from `proxy.ts` (its result was
  unused) and its now-unused import. Middleware only refreshes the session;
  per-request identity resolves in handlers via `withAuth`.

### P1.5 — Tenant identity derivation corrected (CRITICAL consequence)
**File:** `lib/multitenant/context.ts`
- Removed the dangerous `organizationId = payload.org_id || payload.sub`
  fallback, which silently set the org id to the **user id** under real
  Supabase tokens.
- `organizationId` is now resolved server-side from the `profiles` table
  (`profiles.organization_id`) keyed by the authenticated user — it cannot be
  spoofed by the caller. Base role comes from `profiles.role` (normalized to
  `admin | member | viewer`).
- Fails closed: no session or no org membership → `null` → `401`.

### Requirement 4 — RBAC single source of truth
- RBAC (`lib/auth/rbac.ts`) was already backed by the
  `roles/permissions/role_permissions/user_roles` tables. With P1.5 fixed,
  `withAuth` now feeds it the correct `userId` (from the verified session) and
  correct `organizationId` (from `profiles`). Identity = session + `profiles`;
  authorization = RBAC tables. No second source remains.

### Requirement 5 & 7 — Consistent identity across all APIs
- Verified universal adoption: **106** route files authenticate via `withAuth`
  → `extractTenantContext`; the 3 direct callers (`/api/chat`,
  `/api/v1/ai/chat`, `/api/v1/ai/generate`) call the same
  `extractTenantContext`. AI Assistant, Search, Documents, Reporting,
  Workflows, and Billing-protected routes all now resolve identity through the
  single session+profiles path.
- `app/api/v1/tenants/verify` was reviewed: it already validates the real
  session and checks membership against `profiles`; its `X-Tenant-ID` is only
  the org-to-verify parameter, not a trust source. No bypass.

**Files changed (5):** `lib/multitenant/context.ts`, `proxy.ts`,
`lib/supabase/middleware.ts`, `app/api/chat/route.ts` (+ this report).
All five compile with zero TypeScript errors.

---

## What Remains

### P1.6 — Frontend still renders mock data (NOT completed)
- The 7 dashboards (`page.tsx`, `crm`, `healthcare`, `banking`, `agro`,
  `pharma`, `analytics`) still import `lib/mock-data.ts` / inline arrays.
- **Why deferred, not done here:** this is a large, per-page rewrite that risks
  breaking working UI, and — critically — **`banking`, `agro`, and `pharma`
  have no backend tables** in the live schema. Wiring them to "live data" would
  require building new backends, which violates the explicit constraints (no
  new features, preserve functionality). `crm_*`, `healthcare_*`, and
  `analytics_*` tables DO exist and can be wired safely as a focused follow-up.
- **Recommended next step:** wire CRM → `crm_*`, Healthcare → `healthcare_*`,
  Analytics → `analytics_*` via Server Components calling the existing engines;
  treat banking/agro/pharma as a separate product/backend decision.

---

## Remaining Production Blockers

1. **Billing schema/SDK drift (pre-existing, P2).** `tsc` reports real errors in
   `app/actions/payment.ts`, `app/actions/stripe.ts`, `app/api/webhooks/stripe`,
   and `lib/stripe.ts` (`current_period_start/end`, `product_data`, Stripe API
   version `2025-04-30.basil` vs `2026-04-22.dahlia`, `ui_mode: "embedded"`).
   Cancel/checkout flows will fail at runtime until reconciled.
2. **Duplicate Stripe webhooks + no idempotency.** `/api/webhooks/stripe` and
   `/api/v1/billing/webhook-stripe` both exist; neither dedupes on Stripe
   `event.id`. Consolidate to one route and add idempotency.
3. **AI Assistant rate limiting / cost ceiling.** `/api/chat` is now
   authenticated but still unmetered; add per-org rate limiting and spend caps
   (Upstash is available) and remove the hardcoded model string.
4. **No scheduler wired.** Monitoring, workflow `run-scheduled`, retention
   `run-due`, and report schedules depend on an external cron caller that is not
   yet configured.
5. **Passkeys route type errors (pre-existing).** `app/api/auth/passkeys/register`
   references `credentialID`/`credentialPublicKey`/`counter` that don't match the
   installed `@simplewebauthn` types.
6. **`ai-assistant.tsx` `initialMessages` type error (pre-existing).** The
   welcome-message prop doesn't match the installed `@ai-sdk/react` `useChat`
   options type; runtime works but the type is invalid.
7. **`dashboard_stats` RLS deny-all + missing UPDATE/DELETE policies** on several
   tables (mitigated today only because engines use the service-role client).
8. **API-key hashing placeholder** (`hash_${id}`) must be replaced with real
   hashing before API keys are issued.

> Items 1, 2, 5, 6 surfaced as `tsc` errors and are **independent of this
> remediation** (they predate it). The identity/auth keystone (P0.1, P0.2, P0.3,
> P1.4, P1.5) is fully resolved.
