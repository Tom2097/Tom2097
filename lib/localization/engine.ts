import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"
import {
  TRANSLATION_STATUSES,
  type Locale,
  type LocaleBundle,
  type LocaleCompleteness,
  type LocaleInput,
  type LocaleUpdateInput,
  type LocalizationSummary,
  type ListKeysOptions,
  type Translation,
  type TranslationKey,
  type TranslationKeyInput,
  type TranslationKeyUpdateInput,
  type TranslationStatus,
  type TranslationUpsertInput,
} from "./types"

/**
 * Module #20: Localization System engine.
 *
 * Writes go through the service client (RLS-exempt) but EVERY function takes an
 * already-validated `organizationId` (resolved by withAuth) and scopes all I/O
 * to it, preserving the multi-tenant boundary.
 */

const MAX_VALUE = 20_000

function pick<T extends readonly string[]>(allowed: T, v: unknown, fallback: T[number]): T[number] {
  return allowed.includes(v as T[number]) ? (v as T[number]) : fallback
}

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, max)
}

/** Normalize a BCP-47-ish locale code: letters, digits, hyphens. */
export function normalizeCode(input: string): string {
  return input
    .trim()
    .replace(/_/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 35)
}

/** Normalize a namespace/key token. */
function normalizeToken(input: string, max: number): string {
  return input
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, max)
}

// ── Locales ───────────────────────────────────────────────────────────────────

export function validateLocale(input: unknown): string | null {
  if (!input || typeof input !== "object") return "locale must be an object"
  const l = input as LocaleInput
  if (!l.code || typeof l.code !== "string" || !normalizeCode(l.code)) return "code is required"
  if (!l.name || typeof l.name !== "string" || !l.name.trim()) return "name is required"
  if (l.name.length > 120) return "name too long (max 120)"
  return null
}

export async function listLocales(organizationId: string): Promise<Locale[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("locales")
    .select("*")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) {
    logger.logError("[v0] listLocales failed:", { error: error.message })
    throw new Error("failed to list locales")
  }
  return (data ?? []) as Locale[]
}

export async function getLocale(organizationId: string, id: string): Promise<Locale | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("locales")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()
  if (error) {
    logger.logError("[v0] getLocale failed:", { error: error.message })
    throw new Error("failed to fetch locale")
  }
  return (data as Locale) ?? null
}

export async function createLocale(
  organizationId: string,
  createdBy: string,
  input: LocaleInput,
): Promise<Locale> {
  const db = createServiceClient()
  const code = normalizeCode(input.code)

  // Is this the first locale? If so it becomes default regardless of input.
  const { count } = await db
    .from("locales")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
  const isFirst = (count ?? 0) === 0
  const makeDefault = isFirst || input.isDefault === true

  // If making default, clear any existing default first (partial unique index).
  if (makeDefault && !isFirst) {
    await db
      .from("locales")
      .update({ is_default: false })
      .eq("organization_id", organizationId)
      .eq("is_default", true)
  }

  const { data, error } = await db
    .from("locales")
    .insert({
      organization_id: organizationId,
      code,
      name: input.name.trim().slice(0, 120),
      native_name: clampStr(input.nativeName, 120),
      is_default: makeDefault,
      is_enabled: input.isEnabled !== false,
      is_rtl: input.isRtl === true,
      position: typeof input.position === "number" ? input.position : 0,
      created_by: createdBy,
    })
    .select("*")
    .single()
  if (error) {
    if (error.code === "23505") throw new Error(`locale '${code}' already exists`)
    logger.logError("[v0] createLocale failed:", { error: error.message })
    throw new Error("failed to create locale")
  }
  return data as Locale
}

export async function updateLocale(
  organizationId: string,
  id: string,
  input: LocaleUpdateInput,
): Promise<Locale | null> {
  const db = createServiceClient()
  const patch: Record<string, unknown> = {}
  if (typeof input.name === "string" && input.name.trim()) patch.name = input.name.trim().slice(0, 120)
  if ("nativeName" in input) patch.native_name = clampStr(input.nativeName, 120)
  if (typeof input.isRtl === "boolean") patch.is_rtl = input.isRtl
  if (typeof input.isEnabled === "boolean") patch.is_enabled = input.isEnabled
  if (typeof input.position === "number") patch.position = input.position
  if (Object.keys(patch).length === 0) return getLocale(organizationId, id)

  const { data, error } = await db
    .from("locales")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error) {
    logger.logError("[v0] updateLocale failed:", { error: error.message })
    throw new Error("failed to update locale")
  }
  return (data as Locale) ?? null
}

/** Promote a locale to be the org default (atomic swap via the partial index). */
export async function setDefaultLocale(organizationId: string, id: string): Promise<Locale | null> {
  const db = createServiceClient()
  const target = await getLocale(organizationId, id)
  if (!target) return null
  if (target.is_default) return target

  // Clear current default, then set the new one. A disabled locale cannot be default.
  await db
    .from("locales")
    .update({ is_default: false })
    .eq("organization_id", organizationId)
    .eq("is_default", true)
  const { data, error } = await db
    .from("locales")
    .update({ is_default: true, is_enabled: true })
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error) {
    logger.logError("[v0] setDefaultLocale failed:", { error: error.message })
    throw new Error("failed to set default locale")
  }
  return (data as Locale) ?? null
}

/** Delete a locale. The default locale cannot be deleted. */
export async function deleteLocale(organizationId: string, id: string): Promise<"ok" | "not_found" | "is_default"> {
  const db = createServiceClient()
  const existing = await getLocale(organizationId, id)
  if (!existing) return "not_found"
  if (existing.is_default) return "is_default"
  const { error } = await db.from("locales").delete().eq("organization_id", organizationId).eq("id", id)
  if (error) {
    logger.logError("[v0] deleteLocale failed:", { error: error.message })
    throw new Error("failed to delete locale")
  }
  return "ok"
}

// ── Translation keys ────────────────────────────────────────────────────────────

export function validateKey(input: unknown): string | null {
  if (!input || typeof input !== "object") return "key must be an object"
  const k = input as TranslationKeyInput
  if (!k.key || typeof k.key !== "string" || !normalizeToken(k.key, 200)) return "key is required"
  return null
}

export async function listKeys(organizationId: string, opts: ListKeysOptions = {}): Promise<TranslationKey[]> {
  const db = createServiceClient()
  let q = db.from("translation_keys").select("*").eq("organization_id", organizationId)
  if (opts.namespace) q = q.eq("namespace", normalizeToken(opts.namespace, 80))
  if (!opts.includeArchived) q = q.eq("is_archived", false)
  if (opts.search) q = q.ilike("key", `%${opts.search}%`)
  q = q
    .order("namespace", { ascending: true })
    .order("key", { ascending: true })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 200) - 1)
  const { data, error } = await q
  if (error) {
    logger.logError("[v0] listKeys failed:", { error: error.message })
    throw new Error("failed to list keys")
  }
  return (data ?? []) as TranslationKey[]
}

export async function createKey(
  organizationId: string,
  createdBy: string,
  input: TranslationKeyInput,
): Promise<TranslationKey> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("translation_keys")
    .insert({
      organization_id: organizationId,
      namespace: normalizeToken(input.namespace || "common", 80) || "common",
      key: normalizeToken(input.key, 200),
      description: clampStr(input.description, 1000),
      source_text: clampStr(input.sourceText, MAX_VALUE),
      created_by: createdBy,
    })
    .select("*")
    .single()
  if (error) {
    if (error.code === "23505") throw new Error("a key with that namespace + name already exists")
    logger.logError("[v0] createKey failed:", { error: error.message })
    throw new Error("failed to create key")
  }
  return data as TranslationKey
}

export async function updateKey(
  organizationId: string,
  id: string,
  input: TranslationKeyUpdateInput,
): Promise<TranslationKey | null> {
  const db = createServiceClient()
  const patch: Record<string, unknown> = {}
  if ("description" in input) patch.description = clampStr(input.description, 1000)
  if ("sourceText" in input) patch.source_text = clampStr(input.sourceText, MAX_VALUE)
  if (typeof input.isArchived === "boolean") patch.is_archived = input.isArchived
  if (Object.keys(patch).length === 0) {
    const { data } = await db
      .from("translation_keys")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()
    return (data as TranslationKey) ?? null
  }
  const { data, error } = await db
    .from("translation_keys")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error) {
    logger.logError("[v0] updateKey failed:", { error: error.message })
    throw new Error("failed to update key")
  }
  return (data as TranslationKey) ?? null
}

export async function deleteKey(organizationId: string, id: string): Promise<boolean> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("translation_keys")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error) {
    logger.logError("[v0] deleteKey failed:", { error: error.message })
    throw new Error("failed to delete key")
  }
  return !!data
}

// ── Translations ────────────────────────────────────────────────────────────────

/**
 * Upsert a translation value. Resolves the target key + locale by id or by
 * (namespace,key)/code, then inserts or updates the (key_id, locale_id) row.
 */
export async function upsertTranslation(
  organizationId: string,
  updatedBy: string,
  input: TranslationUpsertInput,
): Promise<Translation> {
  const db = createServiceClient()
  if (typeof input.value !== "string") throw new Error("value is required")

  // Resolve locale.
  let localeId = input.localeId
  if (!localeId && input.localeCode) {
    const { data: loc } = await db
      .from("locales")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("code", normalizeCode(input.localeCode))
      .maybeSingle()
    if (!loc) throw new Error("locale not found")
    localeId = (loc as { id: string }).id
  }
  if (!localeId) throw new Error("localeId or localeCode is required")

  // Resolve key.
  let keyId = input.keyId
  if (!keyId && input.key) {
    const { data: k } = await db
      .from("translation_keys")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("namespace", normalizeToken(input.namespace || "common", 80) || "common")
      .eq("key", normalizeToken(input.key, 200))
      .maybeSingle()
    if (!k) throw new Error("translation key not found")
    keyId = (k as { id: string }).id
  }
  if (!keyId) throw new Error("keyId or key is required")

  // Verify both belong to the org (defense in depth).
  const [{ data: localeRow }, { data: keyRow }] = await Promise.all([
    db.from("locales").select("id").eq("organization_id", organizationId).eq("id", localeId).maybeSingle(),
    db.from("translation_keys").select("id").eq("organization_id", organizationId).eq("id", keyId).maybeSingle(),
  ])
  if (!localeRow) throw new Error("locale not found")
  if (!keyRow) throw new Error("translation key not found")

  const status: TranslationStatus = pick(TRANSLATION_STATUSES, input.status, "translated")
  const value = input.value.slice(0, MAX_VALUE)

  const { data, error } = await db
    .from("translations")
    .upsert(
      {
        organization_id: organizationId,
        key_id: keyId,
        locale_id: localeId,
        value,
        status,
        updated_by: updatedBy,
      },
      { onConflict: "key_id,locale_id" },
    )
    .select("*")
    .single()
  if (error) {
    logger.logError("[v0] upsertTranslation failed:", { error: error.message })
    throw new Error("failed to save translation")
  }
  return data as Translation
}

export async function listTranslations(
  organizationId: string,
  opts: { localeId?: string; keyId?: string; limit?: number; offset?: number } = {},
): Promise<Translation[]> {
  const db = createServiceClient()
  let q = db.from("translations").select("*").eq("organization_id", organizationId)
  if (opts.localeId) q = q.eq("locale_id", opts.localeId)
  if (opts.keyId) q = q.eq("key_id", opts.keyId)
  q = q.range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 500) - 1)
  const { data, error } = await q
  if (error) {
    logger.logError("[v0] listTranslations failed:", { error: error.message })
    throw new Error("failed to list translations")
  }
  return (data ?? []) as Translation[]
}

// ── Bundle export + completeness ─────────────────────────────────────────────────

/**
 * Build a flattened translation bundle for one locale (by code), suitable for a
 * client i18n runtime: { namespaces: { ns: { key: value } } }.
 */
export async function getBundle(
  organizationId: string,
  localeCode: string,
  opts: { reviewedOnly?: boolean } = {},
): Promise<LocaleBundle | null> {
  const db = createServiceClient()
  const code = normalizeCode(localeCode)
  const { data: locale } = await db
    .from("locales")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("code", code)
    .maybeSingle()
  if (!locale) return null
  const loc = locale as Locale

  // Pull all non-archived keys + their translation for this locale.
  const { data: keys, error: keysErr } = await db
    .from("translation_keys")
    .select("id, namespace, key")
    .eq("organization_id", organizationId)
    .eq("is_archived", false)
  if (keysErr) {
    logger.logError("[v0] getBundle keys failed:", { error: keysErr.message })
    throw new Error("failed to build bundle")
  }
  const keyList = (keys ?? []) as Array<{ id: string; namespace: string; key: string }>

  let tq = db.from("translations").select("key_id, value, status").eq("organization_id", organizationId).eq("locale_id", loc.id)
  if (opts.reviewedOnly) tq = tq.eq("status", "reviewed")
  const { data: trans, error: transErr } = await tq
  if (transErr) {
    logger.logError("[v0] getBundle translations failed:", { error: transErr.message })
    throw new Error("failed to build bundle")
  }
  const byKey = new Map<string, string>()
  for (const t of (trans ?? []) as Array<{ key_id: string; value: string }>) byKey.set(t.key_id, t.value)

  const namespaces: Record<string, Record<string, string>> = {}
  let count = 0
  for (const k of keyList) {
    const value = byKey.get(k.id)
    if (value === undefined || value === "") continue
    if (!namespaces[k.namespace]) namespaces[k.namespace] = {}
    namespaces[k.namespace][k.key] = value
    count += 1
  }

  return {
    locale: loc.code,
    isDefault: loc.is_default,
    isRtl: loc.is_rtl,
    namespaces,
    count,
    generatedAt: new Date().toISOString(),
  }
}

/** Per-locale completeness across all non-archived keys. */
export async function getSummary(organizationId: string): Promise<LocalizationSummary> {
  const db = createServiceClient()
  const [{ count: totalKeys }, locales] = await Promise.all([
    db
      .from("translation_keys")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_archived", false),
    listLocales(organizationId),
  ])
  const total = totalKeys ?? 0

  const localeStats: LocaleCompleteness[] = []
  let defaultLocale: string | null = null
  for (const loc of locales) {
    if (loc.is_default) defaultLocale = loc.code
    const { data: trans } = await db
      .from("translations")
      .select("status, value")
      .eq("organization_id", organizationId)
      .eq("locale_id", loc.id)
    const rows = (trans ?? []) as Array<{ status: TranslationStatus; value: string }>
    const nonEmpty = rows.filter((r) => r.value && r.value.length > 0)
    const reviewed = nonEmpty.filter((r) => r.status === "reviewed").length
    const translated = nonEmpty.length
    localeStats.push({
      localeId: loc.id,
      code: loc.code,
      name: loc.name,
      isDefault: loc.is_default,
      totalKeys: total,
      translated,
      reviewed,
      missing: Math.max(total - translated, 0),
      percentComplete: total > 0 ? Math.round((translated / total) * 100) : 0,
    })
  }

  return { totalKeys: total, totalLocales: locales.length, defaultLocale, locales: localeStats }
}
