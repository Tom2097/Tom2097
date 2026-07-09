import type { Locale } from './config'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config'

export type Dictionary = typeof import('./translations/en.json')

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import('./translations/en.json').then((m) => m.default),
  hi: () => import('./translations/hi.json').then((m) => m.default),
  pa: () => import('./translations/pa.json').then((m) => m.default),
}

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]?.() ?? dictionaries[DEFAULT_LOCALE]()
}

export function getDictionarySync(locale: Locale): Dictionary {
  // Fallback for contexts where async loading is not practical.
  // In production, async loading is preferred.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(`./translations/${locale}.json`) as Dictionary
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./translations/en.json') as Dictionary
  }
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE }
