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
      // Return the requested values so the UI keeps working (cookie is the source
      // of truth) while surfacing the issue for debugging.
      return NextResponse.json(
        {
          locale: locale || null,
          country: country || null,
          timezone: timezone || null,
          warning: `Could not persist locale preference: ${error.message || 'unknown database error'}. Run migration 20260709120000_add_profile_locale_region.sql if columns are missing.`,
        },
        { status: 200 }
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
