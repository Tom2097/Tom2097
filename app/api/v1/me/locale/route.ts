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
      // Helpful message for the most common failure mode: migration not applied.
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Locale columns not ready', message: 'Run migration 20260709120000_add_profile_locale_region.sql' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to update locale', message: error.message },
        { status: 500 }
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
