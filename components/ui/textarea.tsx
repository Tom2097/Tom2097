'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { useI18nSafe } from '@/components/providers/i18n-provider'

function Textarea({ className, placeholder, ...props }: React.ComponentProps<'textarea'>) {
  // Literal English placeholders are translated via lib/i18n/phrases.ts.
  const i18n = useI18nSafe()
  const translatedPlaceholder = typeof placeholder === 'string' && i18n ? i18n.tx(placeholder) : placeholder
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      placeholder={translatedPlaceholder}
      {...props}
    />
  )
}

export { Textarea }
