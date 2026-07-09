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
      <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
        <SelectTrigger className="w-[140px]" aria-label={t('languageSwitcher.current')}>
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
  )
}
