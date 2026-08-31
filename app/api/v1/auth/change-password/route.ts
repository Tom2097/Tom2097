import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { NextResponse } from "next/server"

export const POST = withAuth(async (req, { userId, organizationId }) => {
  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required" }, { status: 400 })
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: { user }, error: signInError } = await supabase.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  )

  if (signInError || !user) {
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 })
  }

  await logAuthEvent({
    action: "auth.password_changed",
    userId,
    organizationId: organizationId ?? undefined,
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true })
})
