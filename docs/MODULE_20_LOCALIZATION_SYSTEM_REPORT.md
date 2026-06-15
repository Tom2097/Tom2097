# Module #20: Localization System — Implementation Report

**Status:** Complete · **Stack:** Next.js 16 (App Router) · Supabase · multi-tenant RLS
**Spec:** DIGIT MASTER SPECIFICATION v1.0 · Backend-first · Fully additive (no prior module redesigned)

## Overview
A tenant-scoped internationalization backend: org-enabled locales, namespaced
translation keys, and per-locale translation values with a draft → translated →
reviewed lifecycle. Exposes a flattened bundle endpoint for runtime i18n
consumption and a per-locale completeness summary.

## Database (migration `module_20_localization_system`)
| Table | Purpose |
|-------|---------|
| `locales` | Org-enabled languages (BCP-47 code, name, native_name, rtl, position). Exactly one default per org. |
| `translation_keys` | Namespaced message keys (`namespace` + `key` unique per org), translator context + source text, archivable. |
| `translations` | Per-locale values, one per (key, locale), with `draft`/`translated`/`reviewed` status. |

- **RLS** enabled on all 3 tables (6 tenant policies) — SELECT/INSERT gated on `profiles.organization_id = auth.uid()` membership.
- **One default per org** enforced by partial unique index `idx_locales_one_default WHERE is_default`.
- Uniqueness: `locales(org, code)`, `translation_keys(org, namespace, key)`, `translations(key_id, locale_id)`.
- `updated_at` triggers on all tables.
- Permissions `localization:read|write|manage` seeded and granted to system `owner`/`admin` roles.

## Library (`lib/localization/`)
- **types.ts** — entities, inputs, `LocaleBundle`, `LocaleCompleteness`, `LocalizationSummary`.
- **engine.ts** — org-scoped service-client engine:
  - Locale CRUD: first locale auto-becomes default; `setDefaultLocale` atomically swaps the default (and re-enables the target); the default locale is protected from deletion; BCP-47 code normalization.
  - Key CRUD with namespace/key normalization and friendly unique-violation messages.
  - `upsertTranslation`: resolves key + locale by id or by (namespace,key)/code, verifies both belong to the org (defense in depth), upserts on `(key_id, locale_id)`.
  - `getBundle`: flattened `{ namespaces: { ns: { key: value } } }` for a locale, with optional `reviewedOnly`.
  - `getSummary`: per-locale translated/reviewed/missing counts + percent complete.

## API (`app/api/v1/localization/`)
| Route | Methods | Permission |
|-------|---------|------------|
| `locales` | GET, POST | read / write |
| `locales/[id]` | GET, PATCH (`?default=true` to promote), DELETE | read / write / manage |
| `keys` | GET, POST | read / write |
| `keys/[id]` | PATCH, DELETE | write / manage |
| `translations` | GET, PUT/POST (upsert) | read / write |
| `bundle` | GET (`?locale=&reviewedOnly=`) | read |
| `summary` | GET | read |

All routes use `withAuth` (permission-gated) and write `localization.*` audit events.

## Audit
Added 8 `localization.*` actions: locale_created/updated/deleted, default_changed, key_created/updated/deleted, translation_updated.

## Compatibility
Multi-tenant architecture, Supabase Auth, `withAuth`/RBAC, and the existing audit
schema are all reused unchanged. No existing module or table was modified.

## Verification
- `tsc --noEmit` clean across `lib/localization` + `app/api/v1/localization`.
- Schema verified live: 3 tables (RLS on), 3 permissions, one-default partial index, 6 policies.
