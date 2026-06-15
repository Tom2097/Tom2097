# Module #15: Data Retention — Implementation Report

## Overview
A general, cross-resource **retention policy registry + purge engine**. Organizations define one retention policy per resource type; policies are purged on a schedule (cron) or on demand, and every purge is recorded in an execution log. Built backend-first, fully additive, and compatible with the multi-tenant architecture, Supabase Auth, and the existing schema.

## Boundary with Module #10 (Audit Logging)
Module #10 remains the **authoritative owner of audit-log retention**. Module #15 does not reimplement it: a policy with `resource_type = "audit_logs"` delegates its purge to Module #10's existing `runRetentionCleanup` (which calls the `audit_retention_cleanup` procedure and logs `audit.retention_cleanup`). All other resource types are purged via this module's whitelist-only DB function. No previous module was redesigned.

## Schema (migration `module_15_data_retention`)
- **`retention_policies`** — one policy per `(organization_id, resource_type)` (unique). Columns: `resource_type` (CHECK: `audit_logs`, `monitor_checks`, `integration_deliveries`, `notifications`), `retention_days` (1–3650), `is_enabled`, `schedule_interval_hours` (1–8760), `description`, rollup (`last_run_at`, `last_deleted_count`), `next_run_at`. `updated_at` trigger.
- **`retention_runs`** — purge execution log: `policy_id`, `resource_type`, `retention_days`, `status` (success/failed/skipped), `deleted_count`, `trigger` (manual/scheduled), `error`, `triggered_by`.
- **RLS** — both tables org-scoped via `profiles` lookup (3 policies; select on both, insert on policies).
- **Functions**
  - `get_due_retention_policies(int)` — `SECURITY DEFINER`, service-role only; returns enabled policies with `next_run_at <= now()`.
  - `data_retention_purge(uuid, text, int)` — `SECURITY DEFINER`, service-role only. **Hard-coded whitelist** mapping each resource type to its table + timestamp column (`monitor_checks.checked_at`, `integration_deliveries.created_at` excluding `pending`, `notifications.created_at`). Always scoped to the org; raises on unsupported/delegated types so no arbitrary table can be purged.
- **Permissions** — `retention:read|write|manage`, granted to system `owner`/`admin`.

## Library (`lib/retention/`)
- **`types.ts`** — resource-type/status/trigger unions, bounds, `DELEGATED_RESOURCE_TYPES`, and DTOs.
- **`engine.ts`** — supported-resource registry (`isSupportedResourceType`, `isDelegated`, `listSupportedResourceTypes`); policy CRUD with input clamping and friendly unique-violation handling; `runPolicy` (delegates audit_logs to Module #10, routes the rest through the whitelist RPC, always logs a run + advances `next_run_at`); `runPolicyById` (manual); `runDuePolicies` (cron, spans tenants); `listRuns`. All functions take a validated `organizationId` and scope every query to it via the service client.

## API (`app/api/v1/retention/`) — all `withAuth`, permission-checked, audited
| Route | Methods | Permission |
| --- | --- | --- |
| `/retention/policies` | GET (list + supported types), POST (create) | `retention:read` / `retention:write` |
| `/retention/policies/[id]` | GET, PATCH, DELETE | read / write / manage |
| `/retention/policies/[id]/run` | POST (manual purge) | `retention:write` |
| `/retention/runs` | GET (history, filterable) | `retention:read` |
| `/retention/run-due` | POST/GET (cron, `CRON_SECRET` bearer) | system |

## Audit actions
Added: `retention.policy_created`, `retention.policy_updated`, `retention.policy_deleted`, `retention.purge_run`, `retention.purge_failed`.

## Verification
- `tsc --noEmit` clean for `lib/retention/**`, `app/api/v1/retention/**`, and `lib/auth/audit.ts`.
- Schema verified live: 2 tables (RLS enabled), 3 permissions, both helper functions, 3 policies. Purge-target columns confirmed present before relying on them.

## Compatibility
Reuses Supabase Auth + `withAuth` + RBAC + the multi-tenant context. The cron endpoint follows Module #6's `CRON_SECRET` convention. Purely additive — no existing tables, columns, or modules were modified.
