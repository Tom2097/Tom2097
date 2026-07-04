import { withAuth } from "@/lib/auth/with-auth"
import { verify2FACode, twoFARateLimiter } from "@/lib/auth/2fa"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

export const POST = withAuth(async (req, { userId }) => {
  const { code } = await req.json()

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Verification code is required" }, { status: 400 })
  }

  const { allowed } = twoFARateLimiter.canAttempt(userId)
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 })
  }

  twoFARateLimiter.recordAttempt(userId)

  const supabase = createServiceClient()
  const { data: record } = await supabase
    .from("user_2fa")
    .select("secret, backup_codes")
    .eq("user_id", userId)
    .single()

  if (!record) {
    return NextResponse.json({ error: "2FA not set up" }, { status: 404 })
  }

  const result = verify2FACode(code, record.secret, record.backup_codes || [])

  if (!result.valid) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 })
  }

  twoFARateLimiter.clearAttempts(userId)

  await supabase.from("user_2fa").update({ enabled: true }).eq("user_id", userId)

  if (result.isBackupCode && result.backupCodeIndex !== undefined) {
    const codes = [...(record.backup_codes || [])]
    codes.splice(result.backupCodeIndex, 1)
    await supabase.from("user_2fa").update({ backup_codes: codes }).eq("user_id", userId)
  }

  return NextResponse.json({ success: true, usedBackupCode: result.isBackupCode })
})
