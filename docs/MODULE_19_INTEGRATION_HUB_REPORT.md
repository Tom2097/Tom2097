# Module #19: Integration Hub — Implementation Report

Status: Complete. Backend-first, fully additive. No previous module redesigned.

## Scope & boundary
Module #19 is the **outbound** third-party connection layer: organizations register
integrations (webhook / Slack / Discord / generic HTTP), subscribe them to event
types, and the hub fans out **HMAC-signed** deliveries with a logged, retryable
dispatch trail. This is deliberately distinct from Module #6 workflow webhooks,
which are *inbound* triggers — no overlap, no changes to that module.

## Database (migration `module_19_integration_hub`)
- **`integrations`** — org-scoped connections: `provider`, `target_url`, `secret_hash`
  (SHA-256; plaintext shown once), `events` (jsonb subscription list), `headers`,
  `status` (active/paused/disabled), delivery rollup (`last_delivery_at`,
  `last_delivery_status`, `consecutive_failures`).
- **`integration_deliveries`** — outbound dispatch log: `event_type`, `payload`,
  `status` (pending/success/failed), `attempts`/`max_attempts`, `response_status`,
  `response_body`, `error`, `next_retry_at`, `delivered_at`.
- **RLS**: enabled on both tables; tenant SELECT policies scoped via
  `profiles.organization_id = auth.uid()` (3 policies). Writes go through the
  service-role engine with manual org scoping, matching existing modules.
- **`get_pending_integration_deliveries(int)`** — `SECURITY DEFINER`,
  service_role-only helper for a retry cron (pending + attempts<max + due).
- **Permissions**: `integrations:read` / `:write` / `:manage`, granted to system
  `owner` and `admin` roles via `role_permissions`.
- `updated_at` trigger reusing the established touch-function pattern.

## Library (`lib/integrations/`)
- **`types.ts`** — providers, statuses, delivery statuses, an event-type catalog,
  and DB row + input/public shapes (`secret_hash` is stripped to `has_secret`).
- **`engine.ts`** — all functions take a withAuth-resolved `organizationId` and
  scope every query to it:
  - Connection CRUD + `rotateSecret` (generate-once secret, store hash only).
  - `dispatchEvent` — looks up active integrations subscribed to the event and
    queues + attempts a delivery for each.
  - `attemptDelivery` — `fetch` with 10s `AbortController` timeout, `x-digit-event`
    + `x-digit-signature` (HMAC-SHA256) headers, Slack/Discord body wrapping.
  - `recordDeliveryResult` — persists outcome, computes exponential backoff
    `next_retry_at` (1m/5m/15m/1h, max 5 attempts), rolls status onto the parent.
  - `testIntegration`, `listDeliveries`, and a constant-time `verifySignature`.
  - Header sanitization blocks overriding controlled signature/content headers.

## API (`app/api/v1/integrations/`)
All routes wrapped in `withAuth`, permission-gated, and audited.
- `route.ts` — `GET` list (`integrations:read`), `POST` create (`integrations:write`, returns secret once).
- `[id]/route.ts` — `GET` (read) / `PATCH` (write) / `DELETE` (manage).
- `[id]/test/route.ts` — `POST` send a `test.event` (write).
- `[id]/deliveries/route.ts` — `GET` delivery history (read).
- `dispatch/route.ts` — `POST` fan out an event to subscribed integrations (write).

## Audit
Added 6 actions: `integration.created/updated/deleted/tested/dispatched/delivery_failed`.

## Compatibility & verification
- Reuses Supabase Auth, `withAuth`, RBAC permissions, multi-tenant context, the
  shared `audit_logs` table, and the service client — nothing existing was altered.
- Live schema verified: 2 tables (RLS on), 3 permissions, retry function, 3 policies.
- `tsc --noEmit` clean for all Module #19 files.
