'use client'

import React, { createContext, useContext, useState, useCallback, useSyncExternalStore } from 'react'
import {
  type Locale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
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

// No-op subscription: we reload the page on locale changes, so a live subscription
// is unnecessary. useSyncExternalStore lets us read client-only values without
// calling setState inside an effect.
const subscribeNoop = () => () => {}

function useClientValue<T>(clientValue: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribeNoop, clientValue, () => serverValue)
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode
  initialLocale?: Locale
}) {
  const cookieLocale = useClientValue(() => getCookie(LOCALE_COOKIE), undefined)
  const dismissedCookie = useClientValue(() => getCookie(DISMISS_COOKIE), undefined)
  const detectedLocaleRaw = useClientValue(() => {
    const raw = navigator.languages?.[0] || navigator.language || 'en'
    return resolveLocale(raw.split('-')[0])
  }, DEFAULT_LOCALE)

  const [localDismissed, setLocalDismissed] = useState(false)

  const locale = cookieLocale ? resolveLocale(cookieLocale) : initialLocale ?? DEFAULT_LOCALE
  const detectedLocale = detectedLocaleRaw === DEFAULT_LOCALE ? null : detectedLocaleRaw

  const showBanner =
    !cookieLocale &&
    !dismissedCookie &&
    !localDismissed &&
    detectedLocale !== null &&
    detectedLocale !== locale

  const setLocale = useCallback(
    async (newLocale: Locale, options?: { save?: boolean }) => {
      if (!isSupportedLocale(newLocale)) return

      setCookie(LOCALE_COOKIE, newLocale)

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
    setLocalDismissed(true)
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
        showBanner,
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
