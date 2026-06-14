# Module #10: Audit Logging — Implementation Report

## Date
2026-06-14

## Scope
Fully-featured, tenant-scoped audit logging system for the DIGIT platform.
Extends the existing `public.audit_logs` table without redesigning any prior module.

---

## 1. Schema Changes (`module_10_audit_logging` migration)

### 1a. Performance Indexes
Four composite indexes added to `public.audit_logs`:
| Index | Columns |
|---|---|
| `idx_audit_logs_org_time` | `(organization_id, created_at DESC)` — primary list query |
| `idx_audit_logs_action` | `(organization_id, action)` — filter by event type |
| `idx_audit_logs_user` | `(organization_id, user_id)` — filter by actor |
| `idx_audit_logs_resource` | `(organization_id, resource_type, resource_id)` — resource lookups |

### 1b. RLS Fix
- Added `audit_logs_insert_service` policy (`FOR INSERT TO service_role WITH CHECK (true)`) — makes the intent explicit; service role already bypasses RLS by default.
- Added `audit_logs_insert_own_org` policy allowing authenticated users to insert events scoped to their own org (used by `logAuthEvent` in auth flows).

### 1c. Permissions
Three new permission keys registered:
| Key | Description |
|---|---|
| `audit:read` | Read audit log entries for the organization |
| `audit:export` | Export audit log data to CSV/JSON |
| `audit:manage` | Manage audit log retention settings |

Back-fill grant: inserted into `role_permissions` for all existing system `owner`/`admin` roles (no-op if none exist; future orgs get them automatically via `seed_default_roles`).

### 1d. SECURITY DEFINER Functions
- **`get_audit_log_stats(p_org_id, p_days)`** — returns `jsonb` with `total`, `by_action` (top 20), `by_user` (top 10), `by_day` array. Restricted to `service_role`.
- **`audit_retention_cleanup(p_org_id, p_retention_days)`** — hard-deletes entries older than `p_retention_days` (default 365), returns deleted row count. Restricted to `service_role`.

---

## 2. `lib/auth/audit.ts` Changes

| Change | Detail |
|---|---|
| Import fix | Replaced `createClient()` (user-scoped) with `createServiceClient()` — writes always succeed regardless of caller auth state |
| New actions | `audit.exported`, `audit.retention_updated`, `audit.retention_cleanup` added to `AuthAuditAction` union |

---

## 3. `lib/audit/` (new module)

| File | Purpose |
|---|---|
| `types.ts` | `AuditLogEntry`, `AuditLogFilters`, `AuditLogListResult`, `AuditLogStats`, `AuditRetentionSettings` |
| `store.ts` | `listAuditLogs` (filters + pagination), `getAuditLogEntry`, `getAuditLogStats` (via RPC), `exportAuditLogs` (CSV, max 10k rows), `runRetentionCleanup` (via RPC + audit event) |
| `index.ts` | Re-exports both modules |

All store functions use `createServiceClient` — the API layer enforces `audit:read/export/manage` via `withAuth`.

---

## 4. API Routes (`/api/v1/audit/`)

All routes use `withAuth(handler, { requireAll: [...] })` — org-scoped, permission-checked.

| Route | Method | Permission | Description |
|---|---|---|---|
| `/api/v1/audit` | GET | `audit:read` | List entries (filters: action, userId, resourceType, resourceId, since, until; pagination: limit/offset) |
| `/api/v1/audit/stats` | GET | `audit:read` | Aggregated stats via `get_audit_log_stats` (param: `days`, default 30, max 365) |
| `/api/v1/audit/export` | GET | `audit:export` | Download CSV (max 10 000 rows, same filters as list, records `audit.exported` event) |
| `/api/v1/audit/retention` | GET | `audit:manage` | View retention policy |
| `/api/v1/audit/retention` | POST | `audit:manage` | Run cleanup (`{ retentionDays }`, 30–3650, records `audit.retention_updated` event) |
| `/api/v1/audit/[id]` | GET | `audit:read` | Fetch single entry by ID (org-scoped, 404 if not found) |

The previous `/api/v1/auth/audit` route is unchanged (backwards-compatible). The new canonical path is `/api/v1/audit`.

---

## 5. Compatibility

- Reuses `withAuth`, `AuthContext`, `createServiceClient`, and the existing `audit_logs` table — no prior module redesigned.
- `logAuthEvent` caller interface is unchanged; only the internal client swapped.
- `seed_default_roles` automatically grants `audit:*` to future owner/admin roles.
- TypeScript: zero new errors introduced (confirmed via `tsc --noEmit`).

---

## 6. Environment Variables Required
None. The audit module uses the existing `SUPABASE_SERVICE_ROLE_KEY` via `createServiceClient`.
