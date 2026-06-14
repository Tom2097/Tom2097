# Module #3: Dynamic RBAC & Permissions — Implementation Report

**Status:** Complete and deployed
**Spec:** DIGIT MASTER SPECIFICATION v1.0
**Scope (approved):** Role CRUD + per-role permission editing + permission-key policy engine + teams/groups, extending existing defaults.

---

## 1. Compatibility Review (before implementation)

Reviewed existing architecture; **no previous modules were redesigned**:

- **Multi-Tenant Architecture (Module #1):** Reused `extractTenantContext` and tenant scoping. Every new route is wrapped by `withAuth`, which composes Module #1's tenant validation. All new tables carry `organization_id` and are scoped on every query.
- **Supabase Auth (Module #2):** Identity continues to come from Supabase Auth via the validated JWT. No changes to auth flow, sessions, or password handling.
- **Existing DB schema:** Built on top of the existing `roles`, `permissions`, `role_permissions`, `user_roles`, `organizations`, `profiles`, and `audit_logs` tables. Extended the existing `seed_default_roles` and permission-resolution functions rather than replacing them.

---

## 2. What Was Built

### Database (4 migrations)
- `create_teams_schema` — `teams`, `team_members`, `team_roles` tables with RLS (org-scoped SELECT) + 4 new team permissions in the catalog.
- `team_aware_permissions_and_extended_roles` — updated `get_user_permissions` and `user_has_permission` to UNION direct user roles **and** team-inherited roles; extended `seed_default_roles` to add `owner`, `manager`, `user` alongside existing `admin`, `member`, `viewer`.

### Library layer
- `lib/supabase/service.ts` — service-role client for trusted writes (RBAC tables only have SELECT RLS; writes are manually org-scoped after `withAuth` validation).
- `lib/auth/policy.ts` — permission-key policy engine (`evaluatePolicy`, `evaluatePolicies`, `toPermissionKey`).
- `lib/auth/rbac.ts` (extended) — `getRole`, `createRole`, `updateRole`, `deleteRole`, `addPermissionToRole`, `removePermissionFromRole`. System roles protected from rename/delete.
- `lib/auth/teams.ts` — full team lifecycle: list/get/create/update/delete, add/remove members, assign/remove team roles.
- `lib/auth/audit.ts` (extended) — added 9 Module #3 audit action types.

### API routes (all `withAuth`-protected, permission-gated)
| Route | Methods | Permission |
|-------|---------|-----------|
| `/api/v1/auth/roles/[roleId]` | GET / PATCH / DELETE | roles:read / write / delete |
| `/api/v1/auth/roles/[roleId]/permissions` | POST / DELETE | roles:write |
| `/api/v1/auth/teams` | GET / POST | teams:read / write |
| `/api/v1/auth/teams/[teamId]` | GET / PATCH / DELETE | teams:read / write / delete |
| `/api/v1/auth/teams/[teamId]/members` | POST / DELETE | teams:write |
| `/api/v1/auth/teams/[teamId]/roles` | POST / DELETE | teams:assign |

---

## 3. Policy Engine Design

Permission-key based (per approved scope). A `resource:action` request resolves to a permission key (e.g. `teams:write`) and is checked against the user's effective permission set. Effective permissions = direct role assignments ∪ team-inherited role permissions, computed in the database via SECURITY DEFINER functions for correctness and speed.

---

## 4. Teams / Groups

Teams group users within an organization. Roles assigned to a team are inherited by **all** current and future members. This means permission grants can be managed at the group level — adding a user to a team immediately grants them the team's role permissions, with no per-user role assignment needed.

---

## 5. Security Notes

- All write operations validate that the target role/team belongs to the caller's organization before mutating (defense-in-depth even though the service client bypasses RLS).
- System roles (`owner`, `admin`, `manager`, `member`, `user`, `viewer`) cannot be renamed or deleted.
- Every mutation is recorded in `audit_logs` (best-effort, never blocks the request).
- Permission denials are audited via `auth.permission_denied`.

---

## 6. Verification

- `tsc --noEmit` passes cleanly for all new/modified Module #3 files.
- Remaining type errors in the repo are pre-existing (Stripe / passkeys / AI assistant) and untouched by this module.

---

## 7. Not in scope (deferred)

- Delegation chains (temporary role delegation between users) — explicitly excluded per approved scope.
- Conditional/attribute-based policies — excluded; engine is permission-key based.
- Frontend UI — backend-first per request; no UI built.
