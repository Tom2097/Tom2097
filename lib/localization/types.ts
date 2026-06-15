/**
 * Module #20: Localization System — types.
 *
 * Org-enabled locales (exactly one default), namespaced translation keys, and
 * per-locale translation values with a draft/translated/reviewed lifecycle.
 * All records are tenant-scoped by organization_id.
 */

export const TRANSLATION_STATUSES = ["draft", "translated", "reviewed"] as const
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number]

export interface Locale {
  id: string
  organization_id: string
  code: string
  name: string
  native_name: string | null
  is_default: boolean
  is_enabled: boolean
  is_rtl: boolean
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LocaleInput {
  code: string
  name: string
  nativeName?: string | null
  isRtl?: boolean
  isEnabled?: boolean
  isDefault?: boolean
  position?: number
}

export interface LocaleUpdateInput {
  name?: string
  nativeName?: string | null
  isRtl?: boolean
  isEnabled?: boolean
  position?: number
}

export interface TranslationKey {
  id: string
  organization_id: string
  namespace: string
  key: string
  description: string | null
  source_text: string | null
  is_archived: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TranslationKeyInput {
  namespace?: string
  key: string
  description?: string | null
  sourceText?: string | null
}

export interface TranslationKeyUpdateInput {
  description?: string | null
  sourceText?: string | null
  isArchived?: boolean
}

export interface Translation {
  id: string
  organization_id: string
  key_id: string
  locale_id: string
  value: string
  status: TranslationStatus
  updated_by: string | null
  created_at: string
  updated_at: string
}

/** Upsert a translation by (namespace, key, localeCode) or (keyId, localeId). */
export interface TranslationUpsertInput {
  localeCode?: string
  localeId?: string
  namespace?: string
  key?: string
  keyId?: string
  value: string
  status?: TranslationStatus
}

export interface ListKeysOptions {
  namespace?: string
  search?: string
  includeArchived?: boolean
  limit?: number
  offset?: number
}

/** A flattened bundle of translations for one locale, ready for client runtime. */
export interface LocaleBundle {
  locale: string
  isDefault: boolean
  isRtl: boolean
  /** namespace -> { key -> value } */
  namespaces: Record<string, Record<string, string>>
  count: number
  generatedAt: string
}

export interface LocaleCompleteness {
  localeId: string
  code: string
  name: string
  isDefault: boolean
  totalKeys: number
  translated: number
  reviewed: number
  missing: number
  percentComplete: number
}

export interface LocalizationSummary {
  totalKeys: number
  totalLocales: number
  defaultLocale: string | null
  locales: LocaleCompleteness[]
}
