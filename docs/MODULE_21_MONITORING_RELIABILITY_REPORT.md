# Module #21: Monitoring & Reliability — Implementation Report

**Status:** Complete · Backend-first · Fully additive (no prior module redesigned)
**Compatibility:** Multi-Tenant Architecture · Supabase Auth · existing schema/RBAC/audit — all preserved

## Overview
Operational observability layered on top of the existing platform: configurable health-check
**monitors**, time-series **monitor_checks**, and **incidents** with a status **timeline**, plus a
live aggregate **system health** snapshot. Reuses the established org-scoped service-client engine
pattern, `withAuth` + RBAC, and the audit log — nothing in prior modules was modified.

## Schema (migration `module_21_monitoring_reliability`)
- **`monitors`** — health-check config: `type` (http/heartbeat/tcp/internal), `target`, `method`,
  `expected_status`, `interval_seconds`, `timeout_ms`, `degraded_latency_ms`, `is_enabled`, rollup
  state (`last_status`, `last_latency_ms`, `last_checked_at`, `next_check_at`, `consecutive_failures`).
- **`monitor_checks`** — immutable time-series results (`status`, `latency_ms`, `status_code`, `error`).
- **`incidents`** — `severity`, `status` (open→investigating→identified→monitoring→resolved),
  `source` (manual/auto), optional `monitor_id` link, `started_at`/`resolved_at`.
- **`incident_events`** — append-only status/timeline entries.
- All tables org-scoped with **RLS** (6 SELECT/INSERT policies); `updated_at` triggers on monitors & incidents.
- **`get_due_monitors(int)`** — `SECURITY DEFINER`, `service_role`-only scheduler helper for cron-driven checks.
- Permissions **`monitoring:read` / `monitoring:write` / `monitoring:manage`** granted to system owner/admin roles.

## Lib (`lib/monitoring/`)
- **`types.ts`** — shared enums/interfaces (Monitor, MonitorCheck, Incident, IncidentEvent, SystemHealth).
- **`engine.ts`** — org-scoped (every fn takes a validated `organizationId`):
  - Monitor CRUD + validation.
  - `executeCheck` (real `fetch` with timeout/abort for http; passive for heartbeat/internal) and
    `recordCheck` (persists result, updates rollup + `next_check_at`).
  - **Auto-incident lifecycle**: opens an `auto` incident after 3 consecutive failures (deduped),
    auto-resolves it on recovery; both append timeline events. Best-effort — never blocks the check pipeline.
  - Incident CRUD with status transitions appending timeline events; `getSystemHealth` rollup.

## API (`app/api/v1/monitoring/`) — all `withAuth`, permission-gated, audited
- `monitors` GET (read) / POST (write) · `monitors/[id]` GET/PATCH (write) / DELETE (manage)
- `monitors/[id]/check` GET history (read) / POST run-now or heartbeat (write)
- `incidents` GET (read) / POST (write) · `incidents/[id]` GET (read) / PATCH (manage)
- `incidents/[id]/events` GET (read) / POST (manage)
- `health` GET (read) — aggregate snapshot
- Audit actions added: `monitor.created/updated/deleted/checked`, `incident.created/updated/resolved`.

## Verification
- Live schema check: 4 tables present, RLS enabled on all, 3 permissions, `get_due_monitors` present, 6 policies.
- `tsc --noEmit` clean for `lib/monitoring/**` and `app/api/v1/monitoring/**`.
- Multi-tenant boundary preserved: service-client writes always filter by `organization_id`; cross-tenant ids no-op.
