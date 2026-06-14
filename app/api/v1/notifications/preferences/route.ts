import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import {
  listPreferences,
  upsertPreferences,
  validatePreference,
  type PreferenceInput,
} from "@/lib/notifications/preferences"

/**
 * GET /api/v1/notifications/preferences
 * Return the authenticated user's notification preferences (org-scoped).
 *
 * PUT /api/v1/notifications/preferences
 * Upsert one or more preference rows. Body: a single object or an array of
 * { category, channel, enabled }. Users manage only their own preferences.
 */
const get = withAuth(async (_req, { organizationId, userId }) => {
  try {
    const preferences = await listPreferences(organizationId, userId)
    return NextResponse.json({ preferences })
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to list preferences"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})

const put = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const list = Array.isArray(body) ? body : [body]
  if (list.length === 0) {
    return NextResponse.json({ error: "no preferences provided" }, { status: 400 })
  }
  for (const p of list) {
    const invalid = validatePreference(p)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
  }

  try {
    const preferences = await upsertPreferences(organizationId, userId, list as PreferenceInput[])
    await logAuthEvent({
      action: "notification.preferences_updated",
      userId,
      organizationId,
      resourceType: "notification_preference",
      metadata: { count: preferences.length },
      ipAddress: getClientIp(req.headers),
    })
    return NextResponse.json({ preferences })
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to update preferences"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})

export { get as GET, put as PUT }
