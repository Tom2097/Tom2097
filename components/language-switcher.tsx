'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/components/providers/i18n-provider'
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/config'
import { Globe } from 'lucide-react'

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col items-start">
        <span className="text-[10px] leading-none text-muted-foreground">{t('languageSwitcher.label')}</span>
        <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
          <SelectTrigger className="h-auto w-[140px] border-0 bg-transparent p-0 text-sm font-medium shadow-none hover:text-primary" aria-label={t('languageSwitcher.current')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LOCALES.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {`${LOCALE_LABELS[loc].flag} ${LOCALE_LABELS[loc].nativeName}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
