'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  type Locale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  isSupportedLocale,
  resolveLocale,
} from '@/lib/i18n/config'
import { dictionaries } from '@/lib/i18n/dictionaries'
import { getCookie, setCookie } from '@/lib/i18n/cookies'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale, options?: { save?: boolean }) => void
  t: (key: string, params?: Record<string, string | number>) => string
  detectedLocale: Locale | null
  showBanner: boolean
  dismissBanner: () => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

const DISMISS_COOKIE = 'NEXT_LOCALE_DISMISSED'

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE)
  const [detectedLocale, setDetectedLocale] = useState<Locale | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // 1. Apply saved cookie choice if present (overrides server-provided initialLocale).
    const cookieLocale = getCookie(LOCALE_COOKIE)
    const savedLocale = resolveLocale(cookieLocale)
    if (cookieLocale && savedLocale !== locale) {
      setLocaleState(savedLocale)
    }

    // 2. Detect browser language preference.
    const browserLangs = navigator.languages?.length
      ? navigator.languages
      : [navigator.language || 'en']
    const detected = resolveLocale(browserLangs[0].split('-')[0])
    setDetectedLocale(detected)

    // 3. Detect timezone for downstream region formatting.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    // 4. Show banner only when there is no saved choice, the detected language
    //    is supported and non-default, and the user hasn't dismissed before.
    const hasSavedChoice = !!cookieLocale
    const wasDismissed = !!getCookie(DISMISS_COOKIE)
    if (!hasSavedChoice && !wasDismissed && detected !== DEFAULT_LOCALE && detected !== savedLocale) {
      setShowBanner(true)
    }

    // 5. Sync timezone (and inferred country if available) to profile silently.
    if (savedLocale && timezone) {
      fetch('/api/v1/me/locale', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: savedLocale, timezone }),
      }).catch(() => {
        // Silent fail — profile sync is best-effort.
      })
    }
  }, [locale])

  const setLocale = useCallback(
    async (newLocale: Locale, options?: { save?: boolean }) => {
      if (!isSupportedLocale(newLocale)) return

      setCookie(LOCALE_COOKIE, newLocale)
      setShowBanner(false)

      if (options?.save !== false) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        try {
          await fetch('/api/v1/me/locale', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale: newLocale, timezone }),
          })
        } catch {
          // Silent fail; cookie is the source of truth.
        }
      }

      window.location.reload()
    },
    []
  )

  const dismissBanner = useCallback(() => {
    setShowBanner(false)
    // Remember dismissal for 30 days.
    setCookie(DISMISS_COOKIE, '1', 30)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = dictionaries[locale]
      const value = getNestedValue(dict as Record<string, unknown>, key)
      if (typeof value !== 'string') return key
      return value.replace(/{(\w+)}/g, (_, k) => String(params?.[k] ?? `{${k}}`))
    },
    [locale]
  )

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        detectedLocale,
        showBanner: mounted && showBanner,
        dismissBanner,
      }}
    >
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

export function useI18nSafe() {
  return useContext(I18nContext)
}

export { LOCALE_LABELS }
