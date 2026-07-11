'use client'
import { useI18n } from "@/components/providers/i18n-provider"

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

const fallback = {
  title: 'An error occurred',
  unexpected: 'Something went wrong. Please try again.',
  tryAgain: 'Try again',
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const i18n = useI18n()
  const t = i18n?.t || ((key: string) => {
    if (key === 'dashboard.error.title') return fallback.title
    if (key === 'dashboard.error.unexpected') return fallback.unexpected
    if (key === 'dashboard.error.tryAgain') return fallback.tryAgain
    return key
  })

  useEffect(() => {
    console.error('[Dashboard] Error:', error)
  }, [error])

  const translatedTitle = t('dashboard.error.title')
  const title = translatedTitle === 'dashboard.error.title' ? fallback.title : translatedTitle
  const translatedUnexpected = t('dashboard.error.unexpected')
  const unexpected = translatedUnexpected === 'dashboard.error.unexpected' ? fallback.unexpected : translatedUnexpected
  const translatedTryAgain = t('dashboard.error.tryAgain')
  const tryAgain = translatedTryAgain === 'dashboard.error.tryAgain' ? fallback.tryAgain : translatedTryAgain

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="rounded-full bg-red-500/10 p-4">
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : unexpected}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">Digest: {error.digest}</p>
        )}
        <Button onClick={reset} variant="outline">
          {tryAgain}
        </Button>
      </div>
    </div>
  )
}