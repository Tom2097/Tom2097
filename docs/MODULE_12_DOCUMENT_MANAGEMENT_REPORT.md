# Module #12: Document Management — Implementation Report

## Overview
Backend-first document management built on Supabase Storage (private bucket) with
org-scoped metadata tables, versioning, and search-index integration. Fully
additive — no existing module, table, or column was modified.

## Schema (migration `module_12_document_management`)
- **`document_folders`** — optional hierarchy (self-referencing `parent_id`), org-scoped.
- **`documents`** — metadata: `name`, `description`, `folder_id`, `storage_path`,
  `mime_type`, `size_bytes`, `current_version`, `status` (pending/ready/archived),
  `tags[]`, `metadata`, `uploaded_by`. GIN index on tags; composite indexes on
  (org, created_at), (org, folder), (org, status).
- **`document_versions`** — immutable per-upload revisions, `UNIQUE(document_id, version)`.
- **`updated_at` trigger** on documents.
- **RLS** — every table org-scoped via `profiles.organization_id = auth.uid()`
  (4 table policies). Verified enabled on all three.

## Storage
- Private bucket **`documents`** (`public=false`).
- Objects keyed as `<organization_id>/<document_id>/v<n>/<filename>` — the first
  path segment is the tenant boundary.
- 3 storage RLS policies (select/insert/delete) scope objects to the caller's org
  via `(storage.foldername(name))[1]`.
- All client access uses **signed URLs** (short-lived upload + download) generated
  server-side with the service client; bytes never transit the API server.

## Permissions (RBAC)
- `documents:read`, `documents:write`, `documents:delete`.
- Back-filled to system `owner`/`admin` roles; future orgs inherit via `seed_default_roles`.

## Library (`lib/documents/`)
- **`types.ts`** — `Document`, `DocumentVersion`, `DocumentFolder`, query/input types.
- **`engine.ts`** (org-scoped, synchronous `createServiceClient()`):
  - `createUploadTicket` → inserts a `pending` document row + returns a signed upload URL.
  - `confirmUpload` → flips to `ready`, records v1 in `document_versions`, indexes in search.
  - `listDocuments` (folder/status/tag/search filters + pagination), `getDocument`.
  - `updateDocument` (name/description/folder/tags/status; re-indexes search).
  - `addVersionTicket` + `confirmVersion` → increments `current_version`, new version row.
  - `getDownloadUrl` → signed download URL for current or a specific version.
  - `deleteDocument` → removes storage objects, version rows, search index entry, row.
- **Search integration** — best-effort `indexDocument` / `removeDocument` calls from
  `lib/search`; failures are swallowed so document ops never break on indexing.

## API (`app/api/v1/documents/`, all `withAuth` + org-scoped + permission-checked + audited)
- `GET /` list (filters, pagination) — `documents:read`
- `POST /` create upload ticket — `documents:write`
- `POST /[id]/confirm` confirm initial upload — `documents:write`
- `GET /[id]` fetch metadata — `documents:read`
- `PATCH /[id]` update metadata — `documents:write`
- `DELETE /[id]` delete (storage + rows + index) — `documents:delete`
- `GET /[id]/versions` list versions — `documents:read`
- `POST /[id]/versions` new-version upload ticket — `documents:write`
- `POST /[id]/versions/confirm` confirm new version — `documents:write`
- `GET /[id]/download` signed download URL (optional `?version=`) — `documents:read`

## Audit
Added 5 `document.*` actions: `uploaded`, `updated`, `version_added`, `downloaded`, `deleted`.

## Compatibility
- **Multi-tenant** — every query and storage path scoped to `organizationId` from `withAuth`.
- **Supabase Auth** — reuses existing session/`withAuth`/RBAC; no auth changes.
- **Existing schema** — purely additive; no tables/columns altered.

## Verification
- Live schema check: 3 tables (RLS on), private bucket, 3 storage + 4 table policies, 3 permissions.
- `tsc --noEmit` clean for all `lib/documents` and `app/api/v1/documents` files
  (pre-existing unrelated errors in Stripe/passkeys/ai-assistant left untouched).
