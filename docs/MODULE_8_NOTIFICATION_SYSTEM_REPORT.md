# Module #8: Notification System — Implementation Report

Status: Complete · Backend-first · Additive (no previous module redesigned)

## Spec Compliance
- Multi-Tenant Architecture: every table is `organization_id`-scoped; all reads/writes go through `withAuth` and use the session-derived org, never request-body values.
- Supabase Auth: recipients/preferences key off `auth.uid()`; reuses existing RBAC (`get_user_permissions`) and audit log.
- Existing schema: purely additive — two new tables, one function, two permissions. No existing object altered.

## Database (migration `create_notification_system`)
- `notifications` — per-user, org-scoped in-app notifications (`type`, `category`, `priority`, `title`, `body`, `action_url`, `data`, `source`, `read_at`, `expires_at`). Indexes for timeline, unread (partial), and category.
- `notification_preferences` — per-user `(category, channel)` toggles, unique per user; channels `in_app` / `email`.
- RLS: recipients SELECT/UPDATE/DELETE only their own notifications; users fully manage only their own preferences.
- `notification_unread_count(org, user)` — `SECURITY DEFINER`, `EXECUTE` revoked from PUBLIC and granted only to `service_role`.
- Permissions `notifications:send` and `notifications:manage` added to the catalog and granted to system `admin` roles. Reading/marking your own notifications needs only authentication.

## Library (`lib/notifications/`)
- `types.ts` — shared types: `Notification`, `NotificationInput`, `BroadcastInput`, preference types, valid type/priority/channel sets.
- `engine.ts` — `createNotification` (single, honors recipient in_app prefs → returns `null` if suppressed), `broadcast` (to all org members or an explicit user list, filtered by prefs), `listNotifications`, `markRead`, `markAllRead`, `deleteNotification`, `getUnreadCount`. All org-scoped via the service client.
- `preferences.ts` — `getPreferences` / `upsertPreferences` for the current user.

## API (`app/api/v1/notifications/`)
- `GET /` list own (filters: `category`, `unread`, `limit`, `before`); `POST /` create or broadcast (requires `notifications:send`, audited `notification.created` / `notification.broadcast`).
- `GET /unread-count` current user's unread total.
- `PATCH /[notificationId]` mark read · `DELETE /[notificationId]` delete (own only).
- `POST /read-all` mark all read.
- `GET /preferences` · `PUT /preferences` manage own delivery prefs (audited `notification.preferences_updated`).

## Workflow Integration
- `lib/workflows/steps.ts` `send_notification` step upgraded from record-only to real delivery through the engine (`source = "workflow"`). With `user_id` it notifies one recipient; otherwise it broadcasts to the org. Import stays inside the `executeStep` durable boundary — workflow bundle still builds cleanly (6 steps, 1 workflow, no graph-extraction error).

## Verification
- DB smoke test against a real org/user: `unread_count = 3`, billing `in_app` preference disabled = 1, 3 notifications created; test rows deleted afterward (0 remaining).
- `tsc --noEmit`: zero errors in any Module #8 file or in `lib/workflows/steps.ts`. Pre-existing unrelated errors in other modules were left untouched.
- `workflow build`: succeeds with no regressions.
