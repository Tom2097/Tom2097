# Module #13: Reporting Engine — Implementation Report

## Summary
The Reporting Engine is a higher-level composition layer that sits **above** Module #7 (Analytics). It lets an organization define reusable, multi-section reports that pull from several existing modules, schedule them, and persist every generation as an immutable run snapshot. It is fully additive and does **not** redesign Module #7's `analytics_reports` (saved ad-hoc query configs) — analytics sections delegate to `lib/analytics/engine` rather than re-implementing query logic.

## Architecture & Compatibility
- **Multi-Tenant:** every table is `organization_id`-scoped; every engine function takes an already-validated `organizationId` (resolved by `withAuth`) and scopes all I/O to it. Cross-tenant ids no-op rather than leak data.
- **Supabase Auth:** all routes use the existing `withAuth` wrapper and RBAC permission checks. Writes go through the service client (RLS-exempt) but remain org-scoped in code.
- **Existing schema:** no existing tables or columns were modified. Reuses `organizations`, `profiles`, `roles`, `permissions`, `role_permissions`, and reads from `analytics_events` (via the analytics engine), `audit_logs`, `feedback`, and `documents`.

## Database (migration `module_13_reporting_engine`)
- **`report_definitions`** — report template: `name`, `description`, `sections` (jsonb), `range_days` (1–365), `is_active`.
- **`report_schedules`** — at most one per definition (`UNIQUE(definition_id)`): `frequency` (daily/weekly/monthly), `hour_utc`, `is_enabled`, `next_run_at`, `last_run_at`, `recipients`.
- **`report_runs`** — immutable snapshots: `status` (pending/running/completed/failed), `trigger` (manual/scheduled), `range_start/end`, `result` (jsonb), `error`, `completed_at`.
- **RLS:** enabled on all 3 tables; org-scoped SELECT policies (+ INSERT on definitions) via the `profiles` membership subquery. 4 policies total.
- **Indexes:** org+time on definitions and runs, definition+time on runs, partial index on `report_schedules(next_run_at) WHERE is_enabled`.
- **Triggers:** `touch_report_updated_at` maintains `updated_at` on definitions and schedules.
- **`get_due_report_schedules(p_limit)`** — `SECURITY DEFINER`, `service_role`-only helper for a future scheduler/cron to pull due schedules.
- **Permissions:** `reports:read`, `reports:write`, `reports:run` — back-filled to system `owner`/`admin` roles.

## Library (`lib/reporting/`)
- **`types.ts`** — `ReportDefinition`, `ReportSection`, `ReportSchedule`, `ReportRun`, `ReportSectionResult`, source/frequency/status enums, and IO option types.
- **`engine.ts`**:
  - Definition CRUD: `createDefinition`, `listDefinitions`, `getDefinition`, `updateDefinition`, `deleteDefinition` (with section validation/normalization, max 25 sections, dedup keys).
  - Scheduling: `upsertSchedule` (one per definition), `getSchedule`, and pure helpers `isFrequency` / `computeNextRun` (UTC next-run computation).
  - Generation: `generateRun` creates a `running` row, builds each section, and finalizes the snapshot as `completed`/`failed`. Section builders: `buildAnalyticsSection` (delegates to `querySummary`/`runQuery`), `buildAuditSection` (total + by-action), `buildFeedbackSection` (totals + by-status/type + avg rating), `buildDocumentsSection` (totals + by-status + total bytes). Per-section errors are captured without failing the whole run.
  - Run reads: `listRuns`, `getRun`.

## API (`app/api/v1/reports/`)
- `GET /reports` (list, `reports:read`) · `POST /reports` (create, `reports:write`)
- `GET /reports/:id` (`reports:read`) · `PATCH /reports/:id` (`reports:write`) · `DELETE /reports/:id` (`reports:write`)
- `GET|PUT /reports/:id/schedule` (read `reports:read` / upsert `reports:write`)
- `POST /reports/:id/run` (generate on demand, `reports:run`)
- `GET /reports/:id/runs` (list runs, `reports:read`)
- `GET /reports/runs/:runId` (single run, `reports:read`)

All routes are wrapped in `withAuth`, permission-checked, and audited.

## Audit
Added 5 actions to `lib/auth/audit.ts`: `report.created`, `report.updated`, `report.deleted`, `report.scheduled`, `report.generated`.

## Verification
- Schema verified live: 3 tables with RLS enabled, 3 permissions, `get_due_report_schedules` present, 4 policies.
- `tsc --noEmit` is clean for all `lib/reporting` and `app/api/v1/reports` files. (Pre-existing unrelated type errors in other modules were left untouched per the no-redesign directive.)

## Files
- `lib/reporting/types.ts`, `lib/reporting/engine.ts`
- `app/api/v1/reports/route.ts`, `app/api/v1/reports/[id]/route.ts`, `app/api/v1/reports/[id]/schedule/route.ts`, `app/api/v1/reports/[id]/run/route.ts`, `app/api/v1/reports/[id]/runs/route.ts`, `app/api/v1/reports/runs/[runId]/route.ts`
- `lib/auth/audit.ts` (5 new actions)
- Migration: `module_13_reporting_engine`
