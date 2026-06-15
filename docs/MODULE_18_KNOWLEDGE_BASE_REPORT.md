# Module #18: Knowledge Base — Implementation Report

## Summary
Backend implementation of a multi-tenant Knowledge Base: hierarchical categories, articles with a draft/published/archived lifecycle, helpful/not-helpful feedback, and view tracking. Published articles are mirrored into the Module #4 universal search index. Fully additive — no existing modules were modified or redesigned.

## Database (migration `module_18_knowledge_base`)
All tables are tenant-scoped (`organization_id` → `organizations.id`) with RLS enabled.

- **`kb_categories`** — hierarchical (self-referencing `parent_id`), `name`/`slug`/`description`/`position`. Unique `(organization_id, slug)`.
- **`kb_articles`** — `title`/`slug`/`excerpt`/`body`, `status` (`draft`/`published`/`archived`), `tags` jsonb, denormalized `view_count`/`helpful_count`/`not_helpful_count`, `published_at`, `author_id`, optional `category_id`. Unique `(organization_id, slug)`.
- **`kb_article_feedback`** — one helpful/not-helpful vote per user per article (unique `(article_id, user_id)`), optional comment.
- **Triggers:** `updated_at` auto-touch on all three tables.
- **Function:** `increment_kb_article_views(uuid, uuid)` — `SECURITY DEFINER`, service-role-only, atomic view counter.
- **RLS:** 7 policies — tenant-scoped SELECT on all tables; INSERT on categories/articles; self-scoped INSERT on feedback (`user_id = auth.uid()`).
- **Permissions:** `kb:read`, `kb:write`, `kb:manage` seeded and granted to system `owner`/`admin` roles.

## Library (`lib/kb/`)
- **`types.ts`** — `Category`, `Article`, `ArticleFeedback`, input/update/list option types, `ARTICLE_STATUSES`.
- **`engine.ts`** — org-scoped service-client engine:
  - Category CRUD with cross-tenant parent validation and auto-unique slugs.
  - Article CRUD with `slugify` + collision-resolving unique slugs, publish lifecycle (`published_at` stamping, publish/unpublish detection returned to caller for audit).
  - `syncArticleSearch` — mirrors published articles into universal search (`resourceType: "kb_article"`), removes them on unpublish/archive/delete; best-effort, never blocks the primary write.
  - `recordArticleView` — atomic increment via the RPC.
  - `submitArticleFeedback` — upserts the vote and keeps denormalized counts in sync via prior-vote deltas.

## API (`app/api/v1/kb/`)
All routes use `withAuth`, are permission-checked, and audited.

- `categories` — `GET` (list), `POST` (create) — `kb:read` / `kb:write`
- `categories/[id]` — `GET` / `PATCH` / `DELETE` — `kb:read` / `kb:write` / `kb:manage`
- `articles` — `GET` (list w/ status/category/tag/search filters), `POST` (create) — `kb:read` / `kb:write`
- `articles/[id]` — `GET` / `PATCH` (edit/publish/unpublish) / `DELETE` — `kb:read` / `kb:write` / `kb:manage`
- `articles/[id]/view` — `POST` (record view) — `kb:read`
- `articles/[id]/feedback` — `POST` (helpful vote) — `kb:read`

## Audit actions
Added 9: `kb.category_created/updated/deleted`, `kb.article_created/updated/published/unpublished/deleted`, `kb.article_feedback`.

## Compatibility & verification
- **Multi-tenant:** every query scopes to the `organizationId` resolved by `withAuth`; cross-tenant ids no-op.
- **Supabase Auth + RBAC:** reuses `withAuth`, the permissions/roles tables, and the shared audit log.
- **Module #4 search:** integrates via the existing `indexDocument`/`removeDocument` helpers; no changes to the search module.
- **Type-check:** clean for `lib/kb` and `app/api/v1/kb`.
- **Schema verified:** 3 tables queryable, 3 permissions seeded, view-counter RPC callable.
