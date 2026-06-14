# Module #7: Analytics Engine — Implementation Report

## Overview
A multi-tenant analytics engine for event ingestion, aggregation/querying, saved
reports, dashboard overviews, and CSV export. Built backend-first, fully additive,
and compatible with the existing architecture (multi-tenant, Supabase Auth,
existing schema). No previous module was redesigned.

## Database (additive migration `create_analytics_engine`)
- **`analytics_events`** — org-scoped raw event store (`event_name`, `event_category`,
  `source`, `session_id`, `value`, `properties` jsonb, `occurred_at`). Indexed on
  `(organization_id, occurred_at)`, `(organization_id, event_name)`,
  `(organization_id, event_category)`, and a GIN index on `properties`.
- **`analytics_reports`** — org-scoped saved report definitions (`config` jsonb).
- **RLS** enabled on both; members can read rows only for their own org
  (`organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())`),
  matching the existing tenant-isolation pattern.
- **Aggregation functions** (`SECURITY DEFINER`, `search_path=public`):
  - `analytics_event_timeseries(org, event, category, start, end, granularity, agg)`
  - `analytics_event_breakdown(org, event, category, dimension, start, end, agg, limit)`
  - `analytics_event_summary(org, start, end)`
  - All use `format()` with whitelisted column/aggregate/granularity tokens (no raw
    interpolation of user input into identifiers) to prevent SQL injection.
  - `EXECUTE` revoked from `PUBLIC`, granted only to `service_role`. Callers always
    pass the org id validated by `withAuth`, so tenants cannot query other tenants.
- **Permissions**: `analytics:read`, `analytics:write`, `analytics:export` added to
  the catalog and granted to existing system `admin` roles.

## Library (`lib/analytics/`)
- **`types.ts`** — event, query, report, and result types.
- **`engine.ts`** — `trackEvent` / `trackEvents` ingestion (service client, org-scoped)
  and `runTimeseries` / `runBreakdown` / `runSummary` / `getOverview` query helpers
  that call the RPCs with the validated org id.
- **`reports.ts`** — saved-report CRUD (list/get/create/update/delete) + config
  normalization, all org-scoped.
- **`query.ts`** — request parsing, date-range resolution, and CSV serialization.

## API Routes (`app/api/v1/analytics/`)
All wrapped in `withAuth`, deriving `organizationId`/`userId` from the session (never
the request body), with permission checks and audit logging.
- `POST /events` — ingest one or many events (`analytics:write`).
- `POST /query` — run timeseries/breakdown/summary query (`analytics:read`).
- `GET /overview` — dashboard summary + top events + trend (`analytics:read`).
- `GET|POST /reports`, `GET|PATCH|DELETE /reports/[reportId]`,
  `POST /reports/[reportId]/run` — saved reports (`analytics:read`/`analytics:write`).
- `GET /export` — CSV export of a query (`analytics:export`).

## Compatibility & Security
- Multi-tenant: every read/write is scoped to the caller's `organizationId`; the
  org id comes from `withAuth`, and RLS + `service_role`-only RPCs enforce isolation
  in depth.
- Supabase Auth + existing RBAC (`get_user_permissions`) reused unchanged.
- Audit actions added: `analytics.report_created/updated/deleted`, `analytics.exported`.
- `tsc --noEmit` reports no errors in any analytics file.

## Verification
- Migration applied successfully.
- Smoke test inserted 4 events for a real org and confirmed correct results from all
  three aggregation functions (summary: 4 events / 3 distinct / total_value 50.99;
  breakdown by event; daily timeseries; conversion-filtered sum). Test rows removed.
