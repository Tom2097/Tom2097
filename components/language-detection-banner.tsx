'use client'

import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { useI18n } from '@/components/providers/i18n-provider'
import { LOCALE_LABELS } from '@/lib/i18n/config'

export function LanguageDetectionBanner() {
  const { showBanner, dismissBanner, setLocale, detectedLocale, t } = useI18n()

  if (!showBanner || !detectedLocale) return null

  const languageName = LOCALE_LABELS[detectedLocale].nativeName

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-3" role="status" aria-live="polite">
      <div className="container flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-lg" aria-hidden="true">
            {LOCALE_LABELS[detectedLocale].flag}
          </span>
          <span>
            {t('languageBanner.title', { language: languageName })} — {t('languageBanner.description')}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="default" onClick={() => setLocale(detectedLocale)}>
            {t('languageBanner.switch')}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismissBanner}>
            {t('languageBanner.dismiss')}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={dismissBanner}
            aria-label={t('languageBanner.dismiss')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
