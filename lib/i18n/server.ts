import { resolveLocale, type Locale } from './config'
import { getDictionary } from './get-dictionary'

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

export async function getTranslator(locale?: string | null) {
  const resolved = resolveLocale(locale)
  const dict = await getDictionary(resolved)

  return {
    locale: resolved,
    t: (key: string, params?: Record<string, string | number>) => {
      const value = getNestedValue(dict as Record<string, unknown>, key)
      if (typeof value !== 'string') return key
      return value.replace(/{(\w+)}/g, (_, k) => String(params?.[k] ?? `{${k}}`))
    },
  }
}

export { type Locale }
