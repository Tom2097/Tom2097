import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { listPreferences, upsertPreferences, validatePreference, type PreferenceInput } from '@/lib/notifications/preferences'

// Backs app/(dashboard)/settings/page.tsx's notification toggles. Preferences
// are opt-out: the absence of a row means the channel is enabled, so GET
// returns the stored rows and the frontend should treat a missing entry as
// enabled (see listPreferences()'s doc comment).
export async function GET(_request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const preferences = await listPreferences(organizationId, user.id)
    return NextResponse.json({ preferences })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const body = await request.json()

    const validationError = validatePreference(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const preferences = await upsertPreferences(organizationId, user.id, [body as PreferenceInput])
    return NextResponse.json({ success: true, preferences })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
