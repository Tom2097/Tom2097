import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"

const PLATFORMS = ["ios", "android"] as const

/**
 * POST /api/v1/notifications/devices
 * Register (or refresh) this device's push token. Called by the mobile app
 * after it obtains an FCM token, and again whenever FCM rotates it -- upsert
 * on the token itself so a refreshed token replaces the old row rather than
 * accumulating duplicates for the same physical device.
 *
 * Body: { token: string, platform: "ios" | "android" }
 */
const register = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const token = typeof body.token === "string" ? body.token.trim() : ""
  const platform = body.platform as string
  if (!token) return NextResponse.json({ error: "token is required" }, { status: 400 })
  if (!PLATFORMS.includes(platform as (typeof PLATFORMS)[number])) {
    return NextResponse.json({ error: "platform must be 'ios' or 'android'" }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from("device_tokens")
    .upsert(
      { organization_id: organizationId, user_id: userId, token, platform, last_seen_at: new Date().toISOString() },
      { onConflict: "token" },
    )

  if (error) {
    console.error("[v0] device token registration failed:", error.message)
    return NextResponse.json({ error: "Failed to register device" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
})

/**
 * DELETE /api/v1/notifications/devices
 * Unregister a device token (e.g. on logout, or before the app is uninstalled
 * where possible), so it stops receiving push. Scoped to the caller's own
 * user_id so one signed-in device can't unregister another user's token.
 *
 * Body: { token: string }
 */
const unregister = withAuth(async (req: NextRequest, { userId }) => {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const token = typeof body.token === "string" ? body.token.trim() : ""
  if (!token) return NextResponse.json({ error: "token is required" }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db.from("device_tokens").delete().eq("token", token).eq("user_id", userId)

  if (error) {
    console.error("[v0] device token unregistration failed:", error.message)
    return NextResponse.json({ error: "Failed to unregister device" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
})

export { register as POST, unregister as DELETE }
