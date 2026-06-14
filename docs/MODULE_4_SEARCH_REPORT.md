# Module #4: Universal Search System — Implementation Report

**Status:** Complete and deployed
**Spec:** DIGIT MASTER SPECIFICATION v1.0
**Engine:** Upstash Search (hybrid full-text + semantic, built-in embeddings)

## Scope delivered

Per agreed scope: tenant-scoped **indexing**, **search query API**, **faceted filtering**, **autocomplete**, and an **admin backfill** endpoint.

> Spec deviation: the spec names Elasticsearch/OpenSearch, which is not available in this environment. Upstash Search (the connected search integration) is used instead. It provides the equivalent hybrid full-text + semantic capability with zero infrastructure. No other module was redesigned.

## Architecture

A single shared index (`digit-universal`) backs the whole app. Every document is **tenant-scoped** via `organizationId` stored in its content, and **every query is hard-filtered by the caller's `organizationId`** (taken from the auth context, never the request body), so cross-tenant hits are impossible. Document IDs are namespaced `:<organizationId>:<resourceType>:<resourceId>` to prevent collisions across tenants.

## Compatibility

- **Multi-Tenant (Module #1):** all reads/writes filtered by `organizationId` from the validated tenant context.
- **Supabase Auth + RBAC (Modules #2/#3):** every route wrapped in `withAuth`. Indexing requires `analytics:read`, backfill requires `organization:write`; search/autocomplete require only an authenticated tenant member.
- **Existing schema:** backfill reads existing `organizations`, `profiles`, `roles`, `teams` tables; no schema changes were made.
- **Audit (Module #2):** indexing, deletion, and backfill emit `search.*` audit events into `audit_logs`.

## Files

**Library (`lib/search/`)** — pre-existing from branch, reviewed and kept:
- `client.ts` — Upstash Search client, typed content/metadata, scoped-filter + document-id helpers
- `index-helper.ts` — `indexDocuments` / `indexDocument` / `removeDocument(s)`
- `query.ts` — `search`, `searchWithFacets`, `autocomplete`

**API routes (`app/api/v1/search/`):**
- `index/route.ts` (pre-existing) — `POST` upsert, `DELETE` remove
- `backfill/route.ts` (pre-existing) — `POST` bulk-index existing records (admin)
- `route.ts` (**new**) — `GET /api/v1/search` hybrid search + facet counts
- `autocomplete/route.ts` (**new**) — `GET /api/v1/search/autocomplete` type-ahead suggestions

## API reference

| Method | Path | Permission | Purpose |
|--------|------|-----------|---------|
| GET | `/api/v1/search?q=&type=&limit=&semanticWeight=&rerank=` | authenticated | Hybrid search with facets |
| GET | `/api/v1/search/autocomplete?q=&limit=` | authenticated | Title suggestions |
| POST | `/api/v1/search/index` | `analytics:read` | Upsert documents |
| DELETE | `/api/v1/search/index?resourceType=&resourceId=` | `analytics:read` | Remove a document |
| POST | `/api/v1/search/backfill` | `organization:write` | Bulk-index existing records |

## Verification

- `tsc --noEmit` clean for all `lib/search` and `api/v1/search` files.
- Tenant isolation enforced at the query layer (organizationId from auth context).

## Notes / future work

- Search query parameters cap `limit` at 100 and clamp `semanticWeight` to [0,1].
- Facet counts are computed from a wider result window; for very large tenants a dedicated aggregation may be added later.
- Other modules should call `indexDocument` / `removeDocument` on create/update/delete to keep the index in sync as they are built.
