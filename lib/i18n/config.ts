export const SUPPORTED_LOCALES = ['en', 'hi', 'pa'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_COOKIE = 'NEXT_LOCALE'
export const REGION_COOKIE = 'NEXT_REGION'

export const LOCALE_LABELS: Record<Locale, { name: string; nativeName: string; rtl: boolean; flag?: string }> = {
  en: { name: 'English', nativeName: 'English', rtl: false, flag: '🇺🇸' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', rtl: false, flag: '🇮🇳' },
  pa: { name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', rtl: false, flag: '🇮🇳' },
}

export function isSupportedLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale)
}

export function resolveLocale(locale: string | null | undefined): Locale {
  if (locale && isSupportedLocale(locale)) return locale
  return DEFAULT_LOCALE
}

export function extractPrimaryLanguage(acceptLanguage: string): string {
  return acceptLanguage.split(',')[0].split(';')[0].trim().toLowerCase().split('-')[0]
}
