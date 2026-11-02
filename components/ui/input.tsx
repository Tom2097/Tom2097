'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { useI18nSafe } from '@/components/providers/i18n-provider'

function Input({ className, type, placeholder, ...props }: React.ComponentProps<'input'>) {
  // Literal English placeholders are translated via lib/i18n/phrases.ts.
  const i18n = useI18nSafe()
  const translatedPlaceholder = typeof placeholder === 'string' && i18n ? i18n.tx(placeholder) : placeholder
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      placeholder={translatedPlaceholder}
      {...props}
    />
  )
}

export { Input }
