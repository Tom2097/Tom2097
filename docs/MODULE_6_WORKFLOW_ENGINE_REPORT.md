# Module #6 — Workflow Automation Engine — Implementation Report

Status: Complete (backend-first). Built per DIGIT MASTER SPECIFICATION v1.0.

## Scope (confirmed with user)
- Full engine: workflow CRUD, execution history, durable step executor.
- Triggers: manual, event (in-app), webhook (token-auth), scheduled (cron).
- Core step actions: `create_task`, `send_notification`, `ai_generate`, `search_index`, `http_request`, plus `condition` branching.
- Execution via Vercel **Workflow SDK** (durable, resumable, retryable).

## Compatibility (no previous module redesigned)
- **Multi-tenant:** every table carries `organization_id`; all reads scoped via RLS to the caller's org (`profiles.organization_id = auth.uid()` pattern, matching prior modules). Writes go through the service-role client only after `withAuth` resolves tenant context — `organizationId` is never taken from the request body.
- **Supabase Auth:** authenticated routes use the existing `withAuth(req, { permission })` wrapper and typed permission catalog. Added `workflows:read|write|delete|execute` permissions via `ON CONFLICT DO NOTHING`.
- **Existing schema:** purely additive (3 new tables + 4 permission rows). No existing tables/columns altered.
- **Module #4 (Search)** reused by the `search_index` step; **Module #5 (AI)** model config reused by the `ai_generate` step.

## Database (migration `create_workflow_engine`)
- `workflows` — definition: `trigger` (jsonb), `steps` (jsonb), `enabled`, `webhook_token` (unique), `next_run_at`.
- `workflow_executions` — `status`, `trigger_type`, `run_id` (SDK run), `input`, `step_results` (jsonb), `error`, timestamps.
- `workflow_tasks` — tasks produced by the `create_task` action.
- RLS enabled on all three (org-scoped SELECT). Service role performs writes.

## Code
- `lib/workflows/types.ts` — step/trigger/definition types.
- `lib/workflows/store.ts` — tenant-scoped CRUD, execution lifecycle, schedule computation (`cron-parser` v5).
- `lib/workflows/steps.ts` — `"use step"` action implementations (full Node access).
- `lib/workflows/engine.ts` — `runWorkflow` (`"use workflow"`) orchestrator + `triggerWorkflow` start helper.
- `next.config.mjs` — `withWorkflow(...)`; `proxy.ts` matcher excludes `.well-known/workflow/`.

## API (`/api/v1/workflows`)
- `GET/POST /` — list / create.
- `GET/PATCH/DELETE /[workflowId]` — read / update (incl. enable/disable) / delete.
- `POST /[workflowId]/execute` — manual trigger (`workflows:execute`).
- `GET /[workflowId]/executions` and `/[executionId]` — history.
- `POST /events` — fire all matching event-triggered workflows in the caller's org.
- `POST /webhooks/[token]` — public, token-authenticated external trigger.
- `GET /run-scheduled` — cron runner, `CRON_SECRET` bearer auth (wired in `vercel.json`, runs every minute).

## Configuration
- `CRON_SECRET` env var set (guards the scheduled runner).
- `vercel.json` cron entry added for `/api/v1/workflows/run-scheduled`.

## Verification
- `tsc --noEmit`: clean for all Module #6 files.
- `workflow validate`: 2 workflow files detected, no serde issues.

## Deferred (future modules)
- BPMN visual designer / parallel-fan-out steps.
- Per-step manual approval hooks (SDK `createHook` supported by the engine shape but not exposed yet).
