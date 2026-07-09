import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/with-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { isSupportedLocale } from '@/lib/i18n/config'

export const PATCH = withAuth(async (req: NextRequest, { userId }) => {
  try {
    const body = await req.json()
    const { locale, country, timezone } = body

    if (locale && !isSupportedLocale(locale)) {
      return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 })
    }

    const db = createServiceClient()
    const update: Record<string, unknown> = {}
    if (locale) update.locale = locale
    if (country) update.country = country
    if (timezone) update.timezone = timezone

    const { data, error } = await db
      .from('profiles')
      .update(update)
      .eq('id', userId)
      .select('locale, country, timezone')
      .single()

    if (error) {
      console.error('[Locale API] Supabase error:', error)
      // The most common failure is that the migration adding locale/country/timezone
      // columns has not been applied. Surface a clear message instead of a generic 500.
      const msg = (error.message || '').toLowerCase()
      const isMissingColumn =
        msg.includes('column') ||
        msg.includes('locale') ||
        msg.includes('country') ||
        msg.includes('timezone')
      if (isMissingColumn) {
        return NextResponse.json(
          {
            error: 'Locale columns not ready',
            message: 'Run migration 20260709120000_add_profile_locale_region.sql',
            detail: error.message,
          },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to update locale', message: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Locale API] Failed to update locale:', error)
    return NextResponse.json(
      { error: 'Failed to update locale' },
      { status: 500 }
    )
  }
})
