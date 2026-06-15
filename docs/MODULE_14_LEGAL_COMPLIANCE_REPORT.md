# Module #14: Legal & Compliance — Implementation Report

## Summary
Backend-first, fully additive module for managing versioned legal documents, immutable user-consent records, and GDPR data-subject access requests (DSAR). No existing modules were redesigned. Compatible with the Module #1 multi-tenant architecture, Supabase Auth, and the existing RBAC/audit schema.

## Database (migration `module_14_legal_compliance`)
Three new tenant-scoped tables, all with RLS enabled and org-scoped SELECT/INSERT policies:

- **`legal_documents`** — versioned legal docs (`terms`, `privacy`, `cookie`, `dpa`, `acceptable_use`, `custom`). Draft/published/archived lifecycle, per-`doc_type` incrementing `version`, `requires_consent`, `effective_at`/`published_at`. `UNIQUE(organization_id, slug, version)` plus a **partial unique index `idx_legal_docs_one_published`** guaranteeing at most one published version per `(org, doc_type)`.
- **`legal_consents`** — immutable acceptance records pinned to `document_id` + `doc_type` + `document_version`, capturing `user_id`/`subject_email`, `action` (accepted/declined/withdrawn), `ip_address`, `user_agent`, and metadata.
- **`dsar_requests`** — GDPR requests (`access`/`erasure`/`rectification`/`portability`/`restriction`) with a status workflow (`open` → `in_progress` → `awaiting_verification` → `completed`/`rejected`), `subject_email`, `assigned_to`, SLA `due_at`, and `completed_at`.

Supporting objects: `touch_legal_updated_at()` trigger on documents + DSAR; `legal:read`/`legal:write`/`legal:manage` permissions granted to system `owner`/`admin` roles.

## Library (`lib/legal/`)
- **`types.ts`** — enums + row/input/option interfaces.
- **`engine.ts`** — service-client engine, every function scoped to a validated `organizationId`:
  - **Documents**: `createDocument` (auto-versioned draft), `getDocument`, `listDocuments`, `getPublishedDocument`, `updateDocument` (drafts only — published/archived are immutable so consent records stay stable), `publishDocument` (archives the prior live version atomically), `archiveDocument`, `deleteDocument`.
  - **Consents**: `recordConsent` (pins to the document's current version; captures IP/user-agent), `listConsents`.
  - **DSAR**: `validateDsar`, `createDsar` (default 30-day SLA `due_at`), `getDsar`, `listDsar`, `updateDsar` (stamps `completed_at` on terminal transitions, returns a `statusChange` marker for audit).

## API (`app/api/v1/legal/`)
All routes use `withAuth`, are permission-checked, and emit audit events:

- `documents` — `GET` list (`legal:read`), `POST` create draft (`legal:write`)
- `documents/[id]` — `GET` (`legal:read`), `PATCH` edit draft (`legal:write`), `DELETE` (`legal:manage`)
- `documents/[id]/publish` — `POST` publish/archive (`legal:manage`)
- `consents` — `GET` list (`legal:read`), `POST` record consent (`legal:read`, members record their own)
- `dsar` — `GET` list (`legal:read`), `POST` create (`legal:write`)
- `dsar/[id]` — `GET` (`legal:read`), `PATCH` update/resolve (`legal:write`)

## Audit
Added 10 `legal.*` actions to `AuthAuditAction`: document created/updated/published/archived/deleted, consent_recorded, dsar created/updated/completed/rejected.

## Verification
- `tsc --noEmit` clean for `lib/legal` and `app/api/v1/legal`.
- Live schema check: 3 tables (RLS on), 3 permissions, partial unique index present, 6 policies.

## Compatibility
Purely additive — no columns/tables/permissions modified on existing modules. Reuses the shared `audit_logs` table, `withAuth`, RBAC, and the per-tenant `profiles.organization_id` boundary established in Module #1.
