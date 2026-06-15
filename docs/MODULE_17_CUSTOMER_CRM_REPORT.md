# Module #17: Customer CRM — Implementation Report

## Summary
Customer CRM built backend-first and fully additive. Adds companies (accounts), contacts (people), deals (sales pipeline), and a polymorphic activity log. No previous module was modified or redesigned; the module reuses the existing multi-tenant, Supabase Auth, RBAC, and audit infrastructure.

## Database (migration `module_17_customer_crm`)
Four new tenant-scoped tables, all org-scoped with RLS enabled:
- **`crm_companies`** — accounts: name, domain, industry, website, phone, size, annual_revenue, notes, tags, owner.
- **`crm_contacts`** — people: first/last name, email, phone, title, status (`lead|active|inactive|archived`), optional `company_id`, owner.
- **`crm_deals`** — pipeline: title, stage (`lead|qualified|proposal|negotiation|won|lost`), value, currency, probability, expected_close_date, closed_at, optional company/contact links.
- **`crm_activities`** — polymorphic log (`note|call|email|meeting|task`) associated to a `company|contact|deal` via `entity_type`/`entity_id`.

Supporting objects:
- `updated_at` triggers on companies/contacts/deals via shared `touch_crm_updated_at()`.
- Indexes for org listing, name/email search, stage, and entity timelines.
- RLS: 7 SELECT/INSERT policies scoping every row to the caller's organization via `profiles`.
- Permissions `crm:read`, `crm:write`, `crm:manage` inserted and granted to system `owner`/`admin` roles (idempotent).

## Lib (`lib/crm/`)
- **`types.ts`** — shared enums (statuses, stages, activity types, entity types), row/input/update interfaces, list options, and pipeline summary shapes.
- **`engine.ts`** — service-client engine, every function scoped to a validated `organizationId`:
  - Company / Contact / Deal CRUD with input validation, tag sanitization, and field clamping.
  - Deal stage logic: stage-derived default probability and automatic `closed_at` stamping/clearing on won/lost transitions.
  - `getPipelineSummary` — per-stage counts/value, weighted open value (value × probability), and won value.
  - `logActivity` / `listActivities` — polymorphic activity log that verifies the target entity exists within the org before inserting.

## API (`app/api/v1/crm/`)
All routes use `withAuth`, are permission-gated, and audited:
- `companies` (GET list, POST create) and `companies/[id]` (GET/PATCH/DELETE).
- `contacts` (GET list, POST create) and `contacts/[id]` (GET/PATCH/DELETE).
- `deals` (GET list, POST create) and `deals/[id]` (GET/PATCH/DELETE).
- `activities` (GET list, POST log).
- `pipeline` (GET summary).

Reads require `crm:read`, writes `crm:write`, deletes `crm:manage`.

## Audit
Added 10 `crm.*` actions (`company_*`, `contact_*`, `deal_*`, `activity_logged`) to the shared `AuthAuditAction` union; every mutating route writes an audit entry.

## Compatibility & Verification
- Multi-tenant boundary preserved (manual org scoping in engine + RLS in DB).
- Supabase Auth, `withAuth`, RBAC, and audit logging reused unchanged.
- Existing database schema untouched — purely additive.
- Module type-checks cleanly (`tsc --noEmit`); schema verified live (4 tables + RLS, 3 permissions, 7 policies).
