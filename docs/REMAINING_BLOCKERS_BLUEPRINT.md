# DigiT — Remaining Production Blockers: Remediation Blueprint

Lead Architect blueprint for the blockers still open after the P0/P1 identity
remediation. **No code** — analysis, decisions required, and exact wiring only.

Classification legend: **[ARCH]** Architectural · **[SEC]** Security ·
**[INT]** Integration · **[MAP]** Data Mapping · **[CFG]** Configuration

---

## Part A — Unresolved Production Blockers

### B1. Billing schema / Stripe SDK drift  — [INT] + [MAP]
**Why still open.** Pre-existing `tsc` errors in `app/actions/payment.ts`,
`app/actions/stripe.ts`, `app/api/webhooks/stripe`, `lib/stripe.ts`: code reads
`current_period_start/end` and uses `product_data`, `ui_mode:"embedded"`, and a
pinned Stripe API version (`2025-04-30.basil`) that disagrees with the installed
SDK types (`2026-04-22.dahlia`). Not an identity issue, so the P0/P1 pass left
it untouched.
**Decision / info missing.** Which Stripe API version is the contract of record,
and whether checkout is `embedded` vs `hosted`. That choice dictates the type
surface to align to.
**Exact wiring.** Reconcile `lib/stripe.ts` client `apiVersion` with the
installed `stripe` package; map subscription fields to the live `subscriptions`
table — which **does** have `current_period_start`, `current_period_end`,
`cancel_at_period_end`, `stripe_subscription_id`, `stripe_customer_id`,
`plan_id`, `status`. (The earlier `cancelled_at`/`organizations.email`
references must be dropped — those columns do not exist.)
**Connect to:** table `subscriptions`; route `/api/v1/billing/subscriptions`;
Stripe SDK.

### B2. Duplicate Stripe webhooks + no idempotency — [ARCH] + [SEC]
**Why still open.** Two handlers exist (`/api/webhooks/stripe` and
`/api/v1/billing/webhook-stripe`); neither dedupes on Stripe `event.id`.
Consolidation is a design decision, deferred to avoid breaking a live endpoint
Stripe may already point at.
**Decision / info missing.** Which URL is registered in the Stripe Dashboard —
that one survives; the other is deleted.
**Exact wiring.** Keep one route; add an idempotency guard keyed on
`event.id`. Reuse the existing `billing_events` table (it has `external_id`,
`provider`, `event_type`, `status`) as the dedupe ledger — insert-on-first-see,
short-circuit on conflict.
**Connect to:** table `billing_events`; one of the two webhook routes.

### B3. AI Assistant has no rate limit / cost ceiling — [SEC] + [CFG]
**Why still open.** P0.2 closed the auth hole (`/api/chat` now requires a
session), but spend throttling is a separate concern and was scoped out.
**Decision / info missing.** Per-org budget policy (requests/min and monthly
token or dollar cap) and whether limits are per-user or per-organization.
**Exact wiring.** Add an Upstash Redis sliding-window limiter keyed on
`context.organizationId` inside `app/api/chat/route.ts` (and
`/api/v1/ai/chat`, `/api/v1/ai/generate`). Record consumption in the existing
`usage` table (`metric`, `value`, `period_start/end`) for billing visibility.
Replace the hardcoded model string with config.
**Connect to:** Upstash Redis (integration available); table `usage`; routes
`/api/chat`, `/api/v1/ai/*`.

### B4. No scheduler wired for background runners — [CFG] + [INT]
**Why still open.** The runner endpoints exist and are correct, but nothing
invokes them on a cadence. Cron is environment configuration, not application
code, so it was out of scope for the identity fix.
**Decision / info missing.** Hosting cadence per job and the shared invocation
secret (`CRON_SECRET`) for the protected endpoints.
**Exact wiring.** Configure Vercel Cron to call, on schedule:
`/api/v1/workflows/run-scheduled`, `/api/v1/retention/run-due`, report
schedules via `/api/v1/reports/[id]/run`, and monitor checks via
`/api/v1/monitoring/monitors/[id]/check`. These drive tables `workflows`
(`next_run_at`), `report_schedules` (`next_run_at`), `retention_policies`
(`next_run_at`), and `monitors` (`next_check_at`).
**Connect to:** Vercel Cron config; the four runner routes above.

### B5. Passkeys route type errors — [INT]
**Why still open.** `app/api/auth/passkeys/register` references
`credentialID` / `credentialPublicKey` / `counter` that don't match the
installed `@simplewebauthn/server` version's return shape. Pre-existing;
unrelated to the session-identity work.
**Decision / info missing.** Whether passkeys are an in-scope auth method for
launch (the platform default is email/password). If not launching, this is
deferrable; if launching, the field mapping must follow the installed
library version.
**Exact wiring.** Align the verification result destructuring to the installed
`@simplewebauthn` API and persist credentials to the intended store. **Note: no
passkey/credential table exists in the live schema** — a storage table is
missing (see B-gap below).
**Connect to:** `@simplewebauthn/server`; a (currently missing) credentials
table.

### B6. `ai-assistant.tsx` `initialMessages` type error — [INT]
**Why still open.** The welcome-message prop doesn't match the installed
`@ai-sdk/react` `useChat` options type (an AI SDK v5→v6 surface change). Runtime
works; the type is invalid. Cosmetic relative to security, so deferred.
**Decision / info missing.** None — purely a version-API alignment.
**Exact wiring.** Seed the initial assistant message via the supported
mechanism for the installed `@ai-sdk/react` version instead of the
`initialMessages` option. Front-end only; no backend.

### B7. `dashboard_stats` deny-all RLS + missing UPDATE/DELETE policies — [SEC] + [ARCH]
**Why still open.** `dashboard_stats` has RLS enabled with **0 policies** →
unreadable by any non-service client. Several other tables (`documents`,
`kb_articles`, `crm_companies`, `monitors`, `incidents`, `integrations`,
`legal_documents`, `report_definitions`, etc.) have only SELECT/INSERT
policies. Today this is masked because every engine uses the service-role
client. Writing policies is a deliberate security change requiring sign-off,
so it was not bundled into the identity fix.
**Decision / info missing.** The intended access model: keep all mutations
server-side via service role (then form& document that and the table is fine as
read-only to clients), **or** expose direct client reads/writes (then add
explicit org-scoped SELECT/UPDATE/DELETE policies). This is the core
unanswered architectural question.
**Exact wiring.** If client-readable: add an org-scoped SELECT policy to
`dashboard_stats` (`organization_id` ∈ caller's orgs) and matching
UPDATE/DELETE policies to the partial-coverage tables. If service-only: leave
RLS deny-all and ensure no client path reads them directly.
**Connect to:** table `dashboard_stats` (+ the partial-policy tables); RLS.

### B8. API-key hashing placeholder — [SEC]
**Why still open.** Key issuance stores `key_hash` as a non-cryptographic
placeholder (`hash_${id}`). No keys are issued through UI yet, so it wasn't on
the P0 critical path, but it must be fixed before any key is minted.
**Decision / info missing.** Hash algorithm of record (e.g. SHA-256 of the
raw key) and the key display/prefix convention.
**Exact wiring.** Hash the actual secret on creation; store only the hash in
`api_keys.key_hash` and a non-secret `key_prefix` for lookup; compare hashes on
verification. The table already has `key_hash`, `key_prefix`, `scopes`,
`expires_at`.
**Connect to:** table `api_keys`; the tenant-provisioning path
(`lib/multitenant`).

### B-gap. Missing passkey credential storage (surfaced by B5) — [ARCH]
There is no table to persist WebAuthn credentials. If passkeys ship, a
`webauthn_credentials` table (credential id, public key, counter, `user_id`,
`organization_id`) must be designed. Flagged as a gap, not yet a decision.

---

## Part B — P1.6 Frontend Mock-Data → Live Mapping

Six client pages render mock/inline data. Backend readiness varies sharply by
domain. **Tiers:** ✅ wireable now · ⚠️ needs read API on existing tables ·
⛔ no backend (new product build).

### Page-by-page mapping

#### 1. `app/(dashboard)/page.tsx` (Main dashboard) — ⚠️ partial
| Widget | Mock source now | Intended live source | API endpoint | Table(s) | Missing backend |
|---|---|---|---|---|---|
| Top metric cards (AI accuracy, clients, streams, ops) | `dashboardStats` | `dashboard_stats` row for org | **none exists** → add `GET /api/v1/dashboard/stats` | `dashboard_stats` | Read route **and** RLS policy (B7) — table is deny-all |
| Revenue forecast chart | `generateRevenueForecast()` | analytics metrics | `GET /api/v1/analytics/overview` or `/query` | `analytics_metrics` | Metric rows must be seeded; chart shape mapping |
| Operational performance | `generateOperationalMetrics()` | analytics metrics (cpu/memory/network exist as columns) | `GET /api/v1/analytics/query` | `analytics_metrics` | Data seeding |
| Module access / locks | `modules` + subscription | already live (`subscriptions`) | client reads `subscriptions` (works today) | `subscriptions` | none |
| Subscription banner | live | live | direct Supabase read (works) | `subscriptions`, `profiles` | none |

#### 2. `app/(dashboard)/analytics/page.tsx` — ✅ wireable now
| Widget | Mock source | Intended live source | API endpoint | Table(s) | Missing backend |
|---|---|---|---|---|---|
| Revenue / risk / operational charts | `generate*` | analytics engine | `GET /api/v1/analytics/overview`, `/query` | `analytics_metrics`, `analytics_events` | Engine + routes EXIST; needs metric/event data seeded + chart field mapping |
| Summary metric cards | derived from mock | aggregates | `GET /api/v1/analytics/overview` | `analytics_metrics` | none (engine exists) |
| "AI Insights" panel | inline array | AI recommendations | `GET` over recommendations | `ai_recommendations` | No read route for recommendations yet |
| Predictions table | inline array | forecast rows | `/api/v1/analytics/query` | `analytics_metrics` (`forecast`, `actual`) | Forecast data population |
| Export button | non-functional | export | `GET /api/v1/analytics/export` (EXISTS) | — | wire button only |

#### 3. `app/(dashboard)/crm/page.tsx` — ✅ wireable now (strongest)
| Widget | Mock source | Intended live source | API endpoint | Table(s) | Missing backend |
|---|---|---|---|---|---|
| Leads / contacts list | inline `leads` | CRM engine | `GET /api/v1/crm/contacts` (EXISTS) | `crm_contacts` | none |
| Pipeline chart | `generatePipelineData()` | pipeline aggregate | `GET /api/v1/crm/pipeline` (EXISTS) | `crm_deals` | none |
| Deals / stages | inline | deals | `GET /api/v1/crm/deals` (EXISTS) | `crm_deals` | none |
| Companies | inline | companies | `GET /api/v1/crm/companies` (EXISTS) | `crm_companies` | none |
| Activities feed | inline | activities | `GET /api/v1/crm/activities` (EXISTS) | `crm_activities` | none |

CRM is fully serviceable — engine, routes, and tables all present.

#### 4. `app/(dashboard)/healthcare/page.tsx` — ⚠️ tables exist, NO API
| Widget | Mock source | Intended live source | API endpoint | Table(s) | Missing backend |
|---|---|---|---|---|---|
| Patient queue | inline `patientQueue` | patients | **missing** `GET /api/v1/healthcare/patients` | `healthcare_patients` | **No engine, no route** |
| Department status | inline `departmentStats` | departments | **missing** `GET /api/v1/healthcare/departments` | `healthcare_departments` | No engine, no route |
| Resource utilization | `generateOperationalMetrics()` | staff/beds/equipment | **missing** | `healthcare_staff`, `healthcare_departments` | No engine, no route |
| AI health alerts | inline array | alerts | **missing** `GET /api/v1/healthcare/alerts` | `healthcare_alerts` | No engine, no route |
| Metric cards (occupancy, patients, wait, staff) | hardcoded | aggregates | **missing** | `healthcare_patients`, `healthcare_departments`, `healthcare_staff` | No engine, no route |

**Healthcare gap:** 15 `healthcare_*` tables exist (patients, departments,
staff, alerts, billing, compliance, incidents, lab/radiology orders,
medications, prescriptions, supplies, feedback, OR schedule) with org-scoped
SELECT RLS — but there is **no `lib/healthcare` engine and no
`/api/v1/healthcare/*` routes**. This is a *read-API build over an existing
schema* (allowed: surfaces existing data, not a new feature/schema).

#### 5. `app/(dashboard)/banking/page.tsx` — ⛔ no backend
No `banking_*` tables, no engine, no routes. Intended sources (fraud, credit
scoring, market signals) **do not exist** anywhere in the schema. Wiring to
"live" data = building a new module (schema + engine + routes). **Out of scope**
under "no new features." Decision required: build Banking as a product, or mark
the page explicitly as a demo/coming-soon.

#### 6. `app/(dashboard)/agro/page.tsx` — ⛔ no backend
No `agro_*` tables/engine/routes. Same disposition as Banking.

#### 7. `app/(dashboard)/pharma/page.tsx` — ⛔ no backend
No `pharma_*` tables/engine/routes. Same disposition as Banking.

> Shared front-end dependency: all seven pages import generators from
> `lib/mock-data.ts`. Removing it is safe only after each consuming widget has a
> live source; ⛔ pages will still need it (or a "no data" state) until their
> backends exist.

### P1.6 disposition summary
| Page | Tier | Backend status | Action |
|---|---|---|---|
| CRM | ✅ | engine + routes + tables | Wire UI to existing `/api/v1/crm/*` |
| Analytics | ✅ | engine + routes + tables | Wire UI + seed `analytics_metrics`; add recommendations read |
| Main dashboard | ⚠️ | tables, partial routes | Add `dashboard/stats` route + RLS (B7); reuse analytics routes |
| Healthcare | ⚠️ | tables only | Build `lib/healthcare` engine + `/api/v1/healthcare/*` read routes |
| Banking | ⛔ | nothing | Product decision (build module or mark demo) |
| Agro | ⛔ | nothing | Product decision |
| Pharma | ⛔ | nothing | Product decision |

---

## Decisions Required Before Implementation (consolidated)
1. **Stripe**: canonical API version + checkout mode (embedded/hosted). → B1
2. **Webhook**: which registered URL is the survivor. → B2
3. **AI spend policy**: per-org caps and window. → B3
4. **Cron**: cadence per runner + `CRON_SECRET`. → B4
5. **Passkeys**: in scope for launch? If yes, design credential table. → B5/B-gap
6. **RLS model**: service-role-only vs client-direct access. → B7
7. **API-key hashing**: algorithm + prefix convention. → B8
8. **Industry modules**: build Banking/Agro/Pharma backends, or designate
   demo? → P1.6 ⛔ pages

## Recommended Sequencing
1. **Security closeout (no new product):** B7 (RLS model), B8 (key hashing),
   B3 (AI limits), B2 (webhook dedupe), B1 (billing drift).
2. **Config:** B4 (cron).
3. **P1.6 quick wins:** CRM ✅, Analytics ✅, then Main dashboard ⚠️.
4. **P1.6 contained build:** Healthcare read API (engine + routes over existing
   tables).
5. **Product decision gate:** Banking / Agro / Pharma + passkeys.
