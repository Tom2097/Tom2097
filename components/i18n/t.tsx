'use client'

import { useI18nSafe } from '@/components/providers/i18n-provider'

/** Translates a literal English UI phrase via lib/i18n/phrases.ts. */
export function T({ children }: { children: string }) {
  const i18n = useI18nSafe()
  return <>{i18n ? i18n.tx(children) : children}</>
}
