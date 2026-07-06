# Danish Spec Audit Report — DigiT Codebase

**Prepared:** July 6, 2026  
**Scope:** All 9 Danish specification documents audited against the DigiT codebase  
**Methodology:** File-by-file comparison of spec requirements to implementation in `lib/`, `components/digit/`, `app/`, and supporting directories

---

## 1. Executive Summary

The DigiT codebase has substantial implementation coverage across all 9 Danish specs, with **~65% overall implementation maturity**. The strongest areas are **CRM** (25+ components, full CRUD engine, smart layer), **Workspace Configure** (6-step wizard with 10 vertical panels), and **AI Intelligence** (perceive→reason→act pipeline, causal chains, simulation, agents). The weakest areas are the **Admin Layer** (no platform admin app, no tenant lifecycle, no impersonation), **Workspace Technical** compliance features (partial e-signatures, partial document versioning, missing requirement traceability), and **Device Auth** (KYC/registry verification simulated, not production-integrated).

**Implementation maturity by spec:**
| # | Spec | Coverage |
|---|------|----------|
| 1 | Admin Layer | 35% |
| 2 | Device Auth | 55% |
| 3 | Secure Onboarding | 65% |
| 4 | AI Intelligence | 75% |
| 5 | Operational Workspace | 65% |
| 6 | Subscription & Pricing | 60% |
| 7 | Smart Customer CRM | 85% |
| 8 | Configure Workspace | 80% |
| 9 | Workspace Technical | 60% |

---

## 2. Per-Spec Analysis

### 2.1 Admin Layer Spec (admin_layer.txt)

**Spec Requirements:**
- Two admin layers: Tenant admin (customer, within tenant) and Platform admin (super-admin, control plane)
- Tenant admin: org/user management, RBAC, workspace config, AI guardrails, billing & audit views, SSO setup
- Platform admin: tenant lifecycle, impersonation, observability, billing ops, feature management, data governance, incident response
- Tiered admin roles: read-only support, billing admin, security admin, super-admin
- Security model: PoLP, SoD, JIT access, break-glass, hardened auth (MFA, WebAuthn, SSO, IP allowlist)
- Immutable append-only audit log (hash-chained, WORM)

**What's Implemented:**
- `lib/platform/admin-roles.ts` — Tiered admin roles (super_admin, billing_admin, read_only_admin) with scoped access checks
- `lib/multitenant/context.ts` — Tenant context resolution from Supabase Auth session + profiles table (RLS-based isolation)
- `lib/multitenant/abac.ts` — ABAC evaluation engine with rules, conditions, access-level hierarchy
- `lib/auth/rbac.ts` — Dynamic RBAC with roles/permissions/user_roles tables, permission checks, default role seeding
- `lib/auth/audit.ts` — Auth event logging
- `lib/audit/append-only.ts` — Hash-chained (SHA-256) immutable audit entries with chain verification
- `lib/audit/store.ts` — Audit log query store with filters and pagination
- `lib/audit/retention.ts` — Audit log retention policies

**What's Partial/Missing:**
- **No platform admin application** — no separate admin.digit-ai.org or admin routes; `lib/platform/` has only `admin-roles.ts`, `capacity.ts`, `owner.ts` (4 files) — no admin UI exists
- **No tenant lifecycle management** — no provision/suspend/deprovision/hard-delete screens or APIs
- **No impersonation** — "sign in as" / assume-identity not implemented; no consented, time-boxed support access
- **No observability dashboards** — no metrics/logs/traces aggregation UI; `lib/observability/` exists but minimal
- **No feature flags/toggles** — `lib/feature-flags.ts` is a stub; no kill switches, canary releases, or progressive rollout
- **No data governance UI** — no DSAR handling dashboard, data residency configuration, or PII management screens
- **No incident response** — no abuse queue, security queue, on-call rotations, or runbooks
- **No JIT access elevation** — no time-boxed privilege windows or auto-expiry
- **No break-glass** — no alarmed emergency-access path
- **No platform-wide MFA enforcement** — MFA via `lib/auth/2fa/` exists but not enforced at platform level

### 2.2 Device Auth Spec (DigiT Device Auth Spec.pdf)

**Spec Requirements:**
- Passwordless, phishing-resistant sign-up/sign-in
- One-time alphanumeric passcode generated and emailed to company address
- Device-bound credential created on first entry (passkey/WebAuthn)
- Anti-replay: code consumed on use, never reusable on another device
- SSO fallback (Google, Microsoft, Apple, GitHub) for unrecognized devices
- New-device dead-end: no password field works, only SSO or re-enrollment

**What's Implemented:**
- `lib/auth/webauthn/service.ts` — WebAuthn credential registration and verification against `user_devices` table
- `lib/auth/passwordless/service.ts` — 6-character alphanumeric passcode generation, hashed token storage (SHA-256), rate limiting, magic link sending
- `app/secure-onboarding/page.tsx` — Full Stage 4 implementation with `@simplewebauthn/browser` startRegistration, device credential creation, passcode verification
- `lib/auth/oauth/service.ts` — SSO provider integration (Google, Microsoft, Apple, GitHub)

**What's Partial/Missing:**
- **KYC integration is simulated** — `lib/identity/kyc-verification.ts` has a 1500ms delay with mock responses, commented-out references to Onfido/Jumio/Trulioo providers
- **New-device dead-end is mitigated** — the spec's strict dead-end (impossible email+password screen) is softened; the implementation leads with SSO and offers re-enrollment
- **No government ID scanning** — UI for ID capture exists (`governmentIdType`, `governmentIdNumber`) but no actual OCR/ML extraction
- **Photo liveness detection** — `CameraCapture` component exists but liveness check is selfie-only with no anti-spoofing integration
- **Company registry verification is stubbed** — `verifyCompanyAgainstRegistry` in `lib/company/registry-verification.ts` is simulated with a `requestManualReview` fallback
- **No formal anti-replay audit** — code consumption is tracked but no replay-attempt monitoring/alerting

### 2.3 Secure Onboarding Spec (onboarding.txt)

**Spec Requirements:**
- Four-stage secure sign-up: Identity → Company → Role → Secure Access
- Stage 1: Full name, work email (company domain), phone, mandatory live photo with liveness detection
- Stage 2: Company legal name, registration number (CIN/GST), registry verification (MCA/GST), domain-ownership check
- Stage 3: Position/title, domain-authorization binding, role-based provisioning, rate-limiting/abuse checks
- Stage 4: Passwordless device-bound credential with SSO backup
- Standard hardening: log every auth event, rate-limit, encrypt in transit/at rest, tenant isolation

**What's Implemented:**
- `app/secure-onboarding/page.tsx` — Complete 4-stage onboarding wizard:
  - Stage 1: Name, email, phone, photo capture via `CameraCapture`
  - Stage 2: Company details, registration number, website, registry verification API calls
  - Stage 3: Role selection (owner/admin/member), position, authority confirmation
  - Stage 4: Passcode generation/sending, WebAuthn device enrollment, SSO linking
- `lib/identity/kyc-verification.ts` — KYC verification with face match, ID validation, manual review fallback
- `lib/company/registry-verification.ts` — Company registry checking with manual review
- `lib/company/role-approval.ts` — Role-based approval for high-privilege roles
- `lib/auth/passwordless/service.ts` — Rate limiting (maxTokensPerHour configurable), domain-blocking in types

**What's Partial/Missing:**
- **Real registry API not connected** — MCA/GST verification is `await new Promise(r => setTimeout(r, 1000))` with mock data
- **Real KYC provider not connected** — Onfido/Jumio/Shufti Pro integration is just comments and stubs
- **Domain-ownership check stubbed** — `domain-verification.tsx` UI exists but backend verification is simulated
- **Two onboarding flows coexist** — `app/onboarding/page.tsx` (business questionnaire, non-secure) and `app/secure-onboarding/page.tsx` — it's unclear which is canonical
- **No disposable email detection** — referenced in spec but not implemented in code (domains check exists in types but not enforced)

### 2.4 AI Intelligence Spec (ai_spec.txt)

**Spec Requirements:**
- Continuous perceive→reason→act loop (not a chatbox)
- Perceive: Cross-workspace event subscription + scoped reads across modules; reactive (events) + scheduled (cron)
- Reason: Operational graph, scoring (DigiT Score), anomaly detection, forecasting, causal tracing, benchmarking, simulation
- Act: Within guardrails (confidence threshold, HITL), create tasks, draft messages, trigger workflows via automation engine
- UI: Intelligence feed/command center (not chatbox), ranked stream, morning briefing, causal chains with monetary impact
- Hero capability: Cross-workspace causal reasoning connecting cause to consequence across Compliance→Resources→CRM→Performance
- Moat: Learns your business, anonymized network effect, always shows work

**What's Implemented:**
- **Perceive layer:**
  - `lib/intelligence/event-perceiver.ts` — Handles 12+ domain event types (compliance gaps, cert expirations, low stock, anomalies, etc.)
  - `lib/intelligence/engine.ts` — Core `perceive()` function with confidence computation, impact scoring, finding persistence
  - `lib/events/bus.ts` — Event bus with `publish()`, `subscribe()`, webhook delivery (20+ event types defined)
  - `lib/events/cross-workspace.ts` — Cross-workspace event propagation
- **Reason layer:**
  - `lib/intelligence/operational-graph.ts` — Entity graph with `upsertEntity`, `relateEntities`, `getEntityGraph`, `traverseGraph`, `findPath`
  - `lib/intelligence/causal-chain.ts` — Causal chain tracing with monetary risk estimation, cross-module chain discovery
  - `lib/intelligence/ranking.ts` — Finding ranking by impact
  - `lib/intelligence/simulation.ts` — Full what-if simulation engine with baseline computation, projection, delta, risk assessment, recommendations
  - `lib/intelligence/predictive.ts` — Predictive analytics
  - `lib/intelligence/network-effect.ts` — Anonymized cross-tenant network effect
  - `lib/intelligence/learning/` — Learning module for pattern detection
  - `lib/analytics/digit-score.ts` — Composite DigiT Score (compliance 40% + resources 30% + performance 30%)
  - `lib/analytics/anomaly-detection.ts` — Anomaly detection on metric streams
  - `lib/analytics/forecasting.ts` — Time-series forecasting
- **Act layer:**
  - `lib/intelligence/agents.ts` — 4 built-in autonomous agents (Compliance Guardian, Resource Optimizer, Pipeline Protector, Process Optimizer) with finding assignment, capability mapping, guardrail evaluation
  - `lib/intelligence/confidence.ts` — Guardrail decisions (allow/ask/block) based on confidence + monetary risk
  - `lib/intelligence/orchestrator.ts` — Agent orchestration
  - `lib/intelligence/executor.ts` — Action execution
- **UI:**
  - `components/digit/intelligence-command-center.tsx` — Primary AI UI (feed/command center)
  - `components/digit/causal-chain-view.tsx` — Causal chain visualization
  - `components/digit/agent-monitor.tsx` — Agent activity monitoring
  - `components/digit/floating-command-bar.tsx` — Command bar for AI interaction
  - `components/digit/intelligence-feed.tsx` (imported by command center)

**What's Partial/Missing:**
- **LLM core orchestration is basic** — `lib/intelligence/orchestrator.ts` exists but the LLM deciding which analytical jobs to run is not deeply integrated
- **"Night shift" continuous monitoring** — scheduled via `lib/intelligence/scheduler.ts` but not demonstrated as a 24/7 brain
- **Morning briefing** — `lib/intelligence/briefing.ts` exists but UI integration in command center is partial
- **Cross-tenant anonymized insights** — `network-effect.ts` has basic structure but no real data aggregation
- **"Simulate before you commit" UI** — simulation engine exists (`lib/intelligence/simulation.ts`) but no dedicated UI for decision simulation
- **Command-by-intent** — "get me ready for ISO audit" natural language intent parsing not implemented
- **Shows its work** — causal chains are displayed but evidence drill-down UI is basic

### 2.5 Operational Workspace Spec (ops_workspace.txt)

**Spec Requirements:**
- Many intake doors: email-to-workspace, WhatsApp+voice notes, photo/scan, audio/meeting, URL/web clip, connectors, bulk drop
- Understanding layer: auto-classify, structured extraction, summarize, detect intent, auto-route, confidence+source highlighting
- Action layer: auto-create tasks/records, populate CRM/compliance, draft responses, trigger workflows, HITL
- Working surface: unified feed, split view (original + extracted + AI chat), ask across documents (RAG), compare/diff, command bar
- Recipes/playbooks: invoice, contract, meeting, inspection, vertical recipes (pharma, renewables, logistics)
- Creative bets: universal intake+auto-routing, vertical document intelligence, field-ops via voice/WhatsApp, doc→workflow, operational copilot

**What's Implemented:**
- **Intake doors:**
  - `lib/operational/intake.ts` — `ingestFromEmail()`, `ingestVoiceNote()`, `ingestPhoto()`, `ingestFromUrl()`, bulk document ingestion
  - `lib/operational/whatsapp.ts` — WhatsApp message processing
  - `components/digit/universal-intake.tsx` — Universal intake UI
  - `lib/ocr/` — OCR pipeline for photo/scan processing
- **Understanding layer:**
  - `lib/operational/understanding.ts` — `classifyDocument()`, `summarizeDocument()`, `extractFields()` with schemas for invoice, contract, inspection, meeting, report
  - `lib/extraction/engine.ts` — Extraction engine with INVOICE_SCHEMA, CONTRACT_SCHEMA
  - `lib/analytics/nlp.ts` — NLP classification, summarization, entity extraction
  - `components/digit/document-understanding.tsx` — Understanding results UI
  - `components/digit/confidence-indicator.tsx` — Confidence scores with source highlighting
- **Action layer:**
  - `lib/operational/actions.ts` — Auto-create tasks/records from documents
  - `lib/operational/auto-create.ts` — Automated record creation
  - `lib/operational/hitl.ts` — Human-in-the-loop approval workflow
  - `lib/operational/doc-to-workflow.ts` — Convert document to workflow
  - `lib/operational/routing.ts` — Auto-route to workspaces
  - components/digit/routing-rules.tsx — Routing rules configuration
- **Working surface:**
  - `components/digit/document-feed.tsx` — Unified feed with status tracking
  - `components/digit/split-view.tsx` — Split view (document + extraction + AI)
  - `components/digit/compare-view.tsx` — Document comparison/diff
  - `lib/operational/ask-docs.ts` — RAG over document corpus
  - `components/digit/floating-command-bar.tsx` — Command bar
  - `components/digit/operational-copilot.tsx` — Operational copilot
- **Recipes:**
  - `lib/operational/recipes.ts` — Recipe/playbook definitions, execution, vertical recipes
  - `components/digit/vertical-recipes.tsx` — Vertical recipe UI
- **Other:**
  - `components/digit/ocr-results.tsx` — OCR results display
  - `components/digit/advanced-document-processing.tsx` — Advanced processing UI

**What's Partial/Missing:**
- **Audio/meeting recording ingestion** — transcription referenced in spec but no dedicated ingestion path in code
- **Photo/scan OCR integration** — OCR engine exists (`lib/ocr/engine.ts`) but not fully wired into intake pipeline
- **URL/web clip extraction** — `ingestFromUrl()` exists in intake.ts but content extraction is minimal
- **Bulk drop processing** — UI mention but no batch processing backend
- **Vertical document intelligence** — recipe framework exists but pre-built extractors for pharma batch records, SECI reports, e-way bills are not implemented
- **Field-ops via WhatsApp/voice** — voice note ingest exists but the full flow (transcribe→classify→route→alert) is not end-to-end complete

### 2.6 Subscription Models & Pricing Spec (pricing.txt)

**Spec Requirements:**
- Three tiers: Starter ($99/₹3,499), Professional ($399/₹14,999), Enterprise (custom from $1,499/₹1,00,000)
- Feature comparison mapped to actual capabilities (workspaces, CRM, AI Intelligence tiers, team members, AI actions, etc.)
- India plan geo-priced (not currency conversion), billed via Razorpay
- Billing mechanics: annual billing (2 months free), monthly ~20% higher, seats + AI metering overage, free trial + founding discount
- Dual currency: USD via Stripe, INR via Razorpay, GST excluded
- Professional is "most popular" anchor
- Deliverable now vs flagged: 24/7 phone→priority SLA, on-prem→by arrangement, "unlimited"→fair-use

**What's Implemented:**
- `app/pricing/page.tsx` — Full pricing page with:
  - Three-tier card layout with feature comparison
  - Annual/monthly toggle with price recalculation
  - USD/INR currency toggle with geo-pricing
  - Checkout integration (Stripe + Razorpay)
  - "Most popular" badge on Professional
  - Enterprise custom pricing CTAs
- `lib/subscription-data.ts` — Pricing tier definitions, add-ons, platform modules, currencies, INR prices
- `lib/billing/stripe.ts` — Stripe billing integration (subscriptions, invoices, webhooks)
- `lib/billing/razorpay.ts` — Razorpay integration for India
- `lib/billing/metering.ts` — AI action metering
- `lib/billing/usage-tracking.ts` — Usage tracking for billing
- `lib/billing/subscription-lifecycle.ts` — Subscription lifecycle management
- `lib/billing/types.ts` — Billing types and interfaces
- `components/digit/extra-seats-purchase.tsx` — Extra seats add-on purchase UI

**What's Partial/Missing:**
- **India plan geo-gating** — INR pricing visible but location-based gating not enforced (no geo-IP check before showing Razorpay)
- **Dunning** — no automated failed-payment retry/chase logic
- **Full proration** — `lib/billing/subscription-lifecycle.ts` exists but mid-cycle plan change proration not implemented
- **Entitlement gating** — feature-level entitlement checks based on tier not implemented (no isEntitled(tier, feature) function)
- **MRR/ARR/churn dashboard** — no billing analytics dashboards for admin
- **Free trial** — no trial period tracking or expiry enforcement
- **Founding customer discount** — no time-boxed discount system
- **Fair-use soft caps** — "unlimited" team members and AI actions are not internally capped

### 2.7 Smart Customer CRM Spec (crm_spec.txt)

**Spec Requirements:**
- Pass 1 (Journey): Lead Inbox & Triage, Contacts & Accounts, Pipeline/Deal Board, Engagement Timeline, Tasks & Cadences, Communication Hub (email + WhatsApp), Quotes & Proposals, Customer Success, Forecast & Reports
- Pass 2 (Intelligence): AI lead scoring, auto-enrichment/AI SDR, duplicate detection & data hygiene, next-best-action, conversation intelligence, AI drafting, deal-health radar, NL ask-your-CRM
- Pass 3 (Creative): WhatsApp capture & nurture, vertical-aware intelligence, design partner pipeline, buying-signal radar, lead-source ROI, founder's daily briefing
- Platform advantage: auto-provision on Won (create tenant + onboarding workflow)

**What's Implemented:**
- **Engine:**
  - `lib/crm/engine.ts` — Full CRUD for companies (create/list/get/update/delete), contacts, deals, activities with validation, sanitization, pipeline summary computation
  - `lib/crm/types.ts` — Types for all entities: Company, Contact, Deal, Activity, Quote, TimelineEntry, CrmTask, Communication, CustomerAccount, LeadScore, plus all list options
  - `lib/crm/extensions.ts` — CRM extensions
  - `lib/crm/ai-drafting.ts` — AI drafting for emails/proposals
  - `lib/crm/whatsapp.ts` — WhatsApp messaging integration
- **Components (25+ UI components):**
  - `crm-lead-inbox.tsx` — Lead inbox with triage
  - `crm-contacts-manager.tsx` — Contacts management
  - `crm-accounts-hierarchy.tsx` — Account/org hierarchy
  - `crm-pipeline-board.tsx` — Kanban deal pipeline (New→Qualified→Demo→Proposal→Won/Lost)
  - `crm-timeline.tsx` — Engagement timeline
  - `crm-tasks.tsx` — Tasks & cadences
  - `crm-communication-hub.tsx` — Multi-channel communication (email + WhatsApp)
  - `crm-quotes.tsx` — Quotes & proposals generation
  - `crm-customer-success.tsx` — Post-sale success tracking
  - `crm-forecast-reports.tsx` — Forecasting & pipeline reports
  - `crm-sales-analytics.tsx` — Sales analytics
  - `crm-lead-source-roi.tsx` — Lead source ROI tracking
  - `crm-ai-sdr.tsx` — AI SDR/enrichment
  - `crm-conversation-intelligence.tsx` — Conversation intelligence
  - `crm-ask-your-crm.tsx` — NL ask-your-CRM
  - `crm-deal-health.tsx` — Deal health radar
  - `crm-next-best-action.tsx` — Next-best-action suggestions
  - `crm-duplicate-detection.tsx` — Duplicate detection & merge
  - `crm-whatsapp-nurture.tsx` — WhatsApp nurture sequences
  - `crm-vertical-signals.tsx` — Vertical-aware signals
  - `crm-founders-briefing.tsx` — Founder's daily briefing
  - `crm-event-instrumentation.tsx` — Event instrumentation
  - `crm-support-tickets.tsx` — Support tickets
  - `crm-auto-provision.tsx` — Auto-provision on Won
  - Additional components derived from base engine

**What's Partial/Missing:**
- **AI lead scoring** — Not a dedicated module; relies on general analytics engine. Contact scoring factors exist in types but scoring function not implemented in engine
- **Auto-enrichment/AI SDR** — AI drafting exists but auto-enrichment (company size, vertical, news from name/email) is basic
- **Duplicate detection UI** — component exists but auto-merge logic is not implemented
- **Vertical-aware intelligence** — `crm-vertical-signals.tsx` component exists but industry-specific signal processing is nascent
- **Design partner pipeline mode** — not implemented as a distinct pipeline view
- **Buying-signal radar** — component exists but signal monitoring/detection is minimal
- **Auto-provision on Won** — hooks to workflow engine but full tenant provisioning flow needs completion

### 2.8 Configure Workspace Spec (conf_allsteps.txt)

**Spec Requirements:**
- Six-step wizard shared across all 4 workspaces (Compliance teal, Resources blue, Performance amber, Operational indigo)
- Step 1 (General): Name, description, vertical, owner — vertical pre-seeds steps 2-4
- Step 2 (Framework): Workspace-specific — Compliance (standards/controls), Resources (assets/inventory), Performance (metrics/KPIs), Operational (intake doors/routing)
- Step 3 (Data & Integrations): Uploads, connectors, sync frequency, credential authorization
- Step 4 (Features & Automations): Toggle features, AI scope/allowance, HITL confidence threshold
- Step 5 (Roles & Access): View/edit/admin per role, approvals, external guest access
- Step 6 (Review & Activate): Summary with validation, Activate applies config
- Post-launch: Same six steps become tabbed settings hub

**What's Implemented:**
- `components/digit/setup-wizard.tsx` — Complete 6-step wizard with:
  - Step navigation with icons per step
  - Vertical selection (10 verticals: Compliance, Resources, Performance, Operational, Healthcare, Banking, Legal, Manufacturing, Retail, Education)
  - Framework step rendering workspace-specific panels
  - Data integrations configuration
  - Features & automations with AI scope/allowance/HITL
  - Roles & access configuration
  - Review & activate with validation and status
- `components/digit/wizard-panels.tsx` — Framework panels for Compliance (8 standards toggles, audit calendar, CAPA SLA, risk thresholds, review frequency), Resources (asset categories, telemetry, reorder points), Performance (north-star metric, KPI targets), Operational (intake doors, auto-routing, HITL)
- `components/digit/wizard-panels/` — 6 additional vertical panels (Healthcare, Banking, Legal, Manufacturing, Retail, Education) each with custom framework configurations
- `components/digit/settings-panel.tsx` — Post-launch settings hub mode
- `components/digit/generic-workspace.tsx` — Generic workspace layout

**What's Partial/Missing:**
- **Workspace-specific accent colors** — The spec describes distinct header colors per workspace (Compliance teal, Resources blue, etc.) but the wizard uses a unified color scheme
- **Step-rail labels** — Spec describes workspace-specific step labels but implementation uses fixed labels
- **Vertical pre-seeding** — vertical selection exists but pre-seeding of steps 2-4 is not fully implemented (framework defaults loaded but not dynamically from vertical)
- **Post-launch settings hub** — `settings-panel.tsx` exists but deeper integration with workspace-specific settings tabs is partial
- **Connector credential authorization** — credential storage pattern ("authorize through each provider, never stored in DigiT") is documented but connector implementations vary

### 2.9 Client Workspace Technical Spec (tech_spec.txt)

**Spec Requirements:**
- **Compliance:** RLS policies, append-only hash-chained audit tables, document versioning + e-signatures, object storage with signed URLs + TTL + legal-hold, DSAR pipelines, ABAC, NER + zero-shot classification over regulatory feeds, requirement traceability matrix, mock-audit Q&A, CAPA FSM (Open→Investigation→Action→Verification→Closed), weighted scoring engine via materialized views, scheduled compliance checks
- **Resources:** Hierarchical asset registry (adjacency-list/ltree), QR/barcode/RFID tags, ROP/EOQ inventory, OCR pipeline, RAG over document corpus (pgvector hybrid search, reranking), predictive maintenance (time-series anomaly, RUL estimation), contract clause extraction, capacity/utilization metrics, vendor scorecards, onboarding orchestration, reservation/booking with conflict detection, skill matrix + gap analysis
- **Performance:** Semantic/metrics layer, ELT pipeline with incremental refresh + CDC, event instrumentation (funnels, retention), text-to-SQL over semantic layer, anomaly detection (STL, Prophet, Isolation Forest), forecasting (ARIMA/Prophet), driver decomposition + correlation analysis, LLM summarization, threshold alerting, scheduled reports, cohort-based benchmarking (k-anonymity/differential privacy), OKR/KPI tracking
- **Cross-workspace:** Event bus (Postgres LISTEN/NOTIFY, Supabase Realtime, Redis Streams), webhooks with idempotency + retry + DLQ, composite DigiT Score, correlation IDs + structured logging

**What's Implemented:**
- **Compliance:**
  - `lib/compliance/capa.ts` — Full CAPA FSM (open→investigation→action→verification→closed) with state transition validation, SLA deadline enforcement, event publishing
  - `lib/compliance/scoring.ts` — Compliance scoring engine (overall + by-framework) from `compliance_frameworks` and `compliance_evidence` tables
  - `lib/compliance/checks.ts` — Scheduled compliance checks
  - `lib/compliance/audit-trail.ts` — Compliance audit trail
  - `lib/compliance/document-versioning.ts` — Document versioning
  - `lib/compliance/dsar.ts` — DSAR pipeline (data export + cascade delete)
  - `lib/compliance/esignatures.ts` — E-signature capture
  - `lib/compliance/regulatory.ts` — Regulatory feed ingestion
  - `lib/audit/append-only.ts` — SHA-256 hash-chained audit entries
  - `lib/multitenant/abac.ts` — ABAC evaluation engine
  - `lib/audit/retention.ts` — Retention policy enforcement
- **Resources:**
  - `lib/resources/assets.ts` — Hierarchical asset registry (parent_id adjacency list), `getAssetTree()` for tree traversal
  - `lib/resources/inventory.ts` — Inventory with SKU, category, quantity, reorder_point, EOQ, low-stock webhook publishing
  - `lib/resources/qr-rfid.ts` — QR/barcode/RFID tag management
  - `lib/resources/booking.ts` — Reservation/booking with conflict detection
  - `lib/resources/contracts.ts` — Contract extraction
  - `lib/resources/onboarding.ts` — Resource onboarding orchestration
  - `lib/resources/analytics.ts` — Capacity/utilization metrics, vendor scorecards
  - `lib/ocr/engine.ts` — OCR processing pipeline
  - `lib/rag/rag.ts` — RAG over document corpus
  - `lib/search/query.ts` — Hybrid search (full-text + semantic) with reranking
  - `lib/inventory/models.ts` — Inventory models
- **Performance:**
  - `lib/analytics/semantic-layer.ts` — Semantic/metrics layer with MetricDefinition, DimensionDefinition, SemanticQuery
  - `lib/analytics/elt.ts` — ELT pipeline with incremental refresh
  - `lib/analytics/elt-extended.ts` — Extended ELT with CDC
  - `lib/analytics/event-instrumentation.ts` (in lib/events/) — Event instrumentation (funnels, retention)
  - `lib/analytics/text-to-sql.ts` — Text-to-SQL with query guarding (ALLOWED_PATTERNS, BLOCKED_PATTERNS, TABLE_WHITELIST)
  - `lib/analytics/anomaly-detection.ts` — Anomaly detection
  - `lib/analytics/forecasting.ts` — Time-series forecasting
  - `lib/analytics/forecasting-extended.ts` — Extended forecasting
  - `lib/analytics/ai-query.ts` — AI-powered analytics queries
  - `lib/analytics/alerts.ts` — Threshold + anomaly-based alerting
  - `lib/analytics/reports.ts` — Report generation
  - `lib/analytics/reports-schedule.ts` — Scheduled report generation (cron-triggered)
  - `lib/analytics/cohorts.ts` — Cohort analysis
  - `lib/analytics/okr.ts` — OKR/KPI target tracking with pacing/variance analysis
  - `lib/analytics/insight-engine.ts` — Insight engine
  - `lib/analytics/query.ts` — Analytics queries
- **Cross-workspace:**
  - `lib/events/bus.ts` — Event bus with 20+ domain events, webhook dispatch with signature + timeout, subscribe API
  - `lib/events/cross-workspace.ts` — Cross-workspace event propagation
  - `lib/webhooks/` — Webhook handling with idempotency, retry, DLQ
  - `lib/analytics/digit-score.ts` — Composite DigiT Score (compliance 40% + resources 30% + performance 30%)
  - `lib/logging.ts` + `lib/logging-client.ts` — Structured logging infrastructure

**What's Partial/Missing:**
- **Requirement traceability matrix** — Not implemented. The spec requires an LLM that maps each control to stored evidence with score deductions
- **Mock-audit Q&A** — Referenced in spec but not implemented
- **NER over regulatory feeds** — `lib/compliance/regulatory.ts` exists but NER + zero-shot classification over feeds is not implemented
- **Predictive maintenance with RUL** — Time-series anomaly exists but RUL estimation and IoT telemetry ingest (MQTT/webhook for turbines/trucks/HPLCs) is not implemented
- **Contract clause/key-value extraction** — `lib/resources/contracts.ts` exists but fine-grained clause extraction (renewal dates, obligations, penalties) is minimal
- **Skill matrix + gap analysis** — Not implemented
- **Cohort-based benchmarking with k-anonymity/differential privacy** — Not implemented
- **Driver decomposition + correlation analysis** — Referenced in spec but not implemented as a cross-workspace root-cause analysis tool
- **LLM summarization for auto-generated briefings** — `lib/intelligence/briefing.ts` exists but integration with performance analytics is partial
- **Materialized views for compliance scoring** — Scoring queries exist but no materialized view optimization

---

## 3. Prioritized Remaining Work Items

### P0 — Critical Gaps (Must implement before launch)

| # | Item | Spec | Effort | Impact |
|---|------|------|--------|--------|
| 1 | **Platform admin application** — Build admin.digit-ai.org with tenant lifecycle (provision/suspend/deprovision), cross-tenant views, and service-role-gated APIs | Admin Layer | High | Blocks multi-tenant operations |
| 2 | **Impersonation (support access)** — "Sign in as" with consent, time-boxing, full audit trail | Admin Layer | Medium | Blocks customer support |
| 3 | **Real KYC & registry verification** — Connect actual KYC provider (Onfido/Jumio) and business registry APIs (MCA/GST) | Device Auth, Secure Onboarding | High | Security prerequisite |
| 4 | **Entitlement gating** — Enforce feature-level access by tier across all workspaces | Pricing | Medium | Revenue protection |
| 5 | **Data governance (DSAR) UI** — Build DSAR handling dashboard with data export, cascade-delete, and consent management | Admin Layer, Technical | Medium | Legal compliance (DPDP/GDPR) |

### P1 — High Priority (Complete for beta)

| # | Item | Spec | Effort | Impact |
|---|------|------|--------|--------|
| 6 | **Tenant lifecycle UI** — Provision, suspend, deprovision, soft/hard delete from admin panel | Admin Layer | Medium | Operational necessity |
| 7 | **JIT access elevation** — Time-boxed privilege windows with auto-expiry for admin actions | Admin Layer | Medium | Security |
| 8 | **Requirement traceability matrix** — LLM mapping of framework controls to tenant evidence with gap scoring | Technical | High | Core compliance feature |
| 9 | **Predictive maintenance** — IoT telemetry ingest (MQTT/Webhook), RUL estimation, sensor anomaly pipeline | Technical | High | Key Resources differentiator |
| 10 | **Dunning + proration** — Automated failed-payment retry, mid-cycle proration logic | Pricing | Medium | Revenue operations |
| 11 | **New-device dead-end hardening** — Implement strict anti-replay with audit-logged replay attempt monitoring | Device Auth | Low | Security hardening |
| 12 | **India plan geo-gating** — Geo-IP detection to restrict INR pricing to Indian users | Pricing | Low | Pricing integrity |

### P2 — Medium Priority (Post-beta, pre-GA)

| # | Item | Spec | Effort | Impact |
|---|------|------|--------|--------|
| 13 | **Observability dashboards** — Metrics/logs/traces aggregation, SLI/SLO/SLA tracking | Admin Layer | High | Platform maturity |
| 14 | **Feature flags & kill switches** — Toggle/infra for progressive rollout, canary releases, entitlement gating | Admin Layer | Medium | Release safety |
| 15 | **Incident response** — Abuse queue, security queue, on-call rotations, runbooks | Admin Layer | Medium | Trust & safety |
| 16 | **Break-glass access** — Alarmed emergency-access path for incidents | Admin Layer | Low | Security safety net |
| 17 | **Vertical document intelligence** — Pre-built extractors for pharma batch records, SECI reports, e-way bills | Operational | Medium | Vertical market expansion |
| 18 | **Cohort benchmarking with differential privacy** — K-anonymity/dp for safe cross-tenant comparisons | Technical | High | Network effect enabler |
| 19 | **Driver decomposition** — Cross-workspace root-cause analysis (Performance dip ↔ Resource shortage ↔ Compliance lapse) | Technical, AI | High | Core AI feature |
| 20 | **AI lead scoring module** — Dedicated lead scoring with configurable factors and model training | CRM | Medium | CRM intelligence |

### P3 — Lower Priority (Post-GA roadmap)

| # | Item | Spec | Effort | Impact |
|---|------|------|--------|--------|
| 21 | **LLM orchestration refinement** — LLM deciding which analytical jobs to run and composing them on demand | AI | High | Intelligence quality |
| 22 | **"Simulate before you commit" UI** — Dedicated decision simulation interface (flight simulator for decisions) | AI | Medium | Sales differentiator |
| 23 | **Audio/meeting recording ingestion** — Automatic transcription and processing pipeline | Operational | Medium | Intake completeness |
| 24 | **Bulk drop processing** — Batch document ingestion with progress tracking | Operational | Medium | UX improvement |
| 25 | **Skill matrix + gap analysis** — Competency-vs-requirement matrix queries | Technical | Medium | HR/resource feature |
| 26 | **E-signature full integration** — End-to-end e-sign with document binding, audit chain, 21 CFR Part 11 compliance | Technical | High | Compliance completeness |
| 27 | **Materialized views for scoring** — Optimize Compliance Score and DigiT Score with materialized views | Technical | Low | Performance |
| 28 | **Free trial + founding discount system** — Time-boxed trial/coupon infrastructure | Pricing | Medium | Growth |
| 29 | **MRR/ARR/churn dashboard for admin** — Billing analytics | Pricing | Medium | Business ops |
| 30 | **Design partner pipeline mode** — Special pipeline tuned for founder-led early sales | CRM | Low | Early sales tool |

---

**Total estimated remaining work: ~6-9 months for P0-P1, 12+ months for full spec compliance**

**Strongest areas:** CRM (85% complete), Configure Workspace (80%), AI Intelligence (75%)  
**Weakest areas:** Admin Layer (35%), Device Auth (55%), Subscription Pricing (60%), Technical Compliance features (60%)
