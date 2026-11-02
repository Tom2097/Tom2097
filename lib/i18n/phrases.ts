import hi from './phrases/hi.json'
import pa from './phrases/pa.json'
import type { Locale } from './config'

/**
 * Phrase table for UI text that was written as plain English in JSX (not
 * keyed t() lookups). Keys are the English text with whitespace collapsed;
 * a missing entry falls back to the English, so a page can never break --
 * at worst a phrase shows untranslated.
 *
 * Use <T>English text</T> for JSX text and `tx("English text")` (from
 * useI18n() / getTranslator()) where a plain string is required. The UI
 * primitives Input, Textarea and SelectValue translate their placeholder
 * through this table automatically.
 */
const PHRASES: Partial<Record<Locale, Record<string, string>>> = { hi, pa }

export function normalizePhrase(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function translatePhrase(locale: Locale, text: string): string {
  if (locale === 'en' || !text) return text
  const table = PHRASES[locale]
  if (!table) return text
  const key = normalizePhrase(text)
  const hit = table[key]
  if (!hit) return text
  // Preserve the original's leading/trailing whitespace (JSX text spacing).
  const lead = text.match(/^\s*/)?.[0] ?? ''
  const trail = text.match(/\s*$/)?.[0] ?? ''
  return lead + hit + trail
}
