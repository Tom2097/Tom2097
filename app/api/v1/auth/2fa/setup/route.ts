import { withAuth } from "@/lib/auth/with-auth"
import { generateTOTPSetup } from "@/lib/auth/2fa"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

export const POST = withAuth(async (req, { userId, email }) => {
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from("user_2fa")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: "2FA already configured" },
      { status: 409 }
    )
  }

  const setup = await generateTOTPSetup("DigiT", email || "user")

  const { error } = await supabase.from("user_2fa").insert({
    user_id: userId,
    secret: setup.secret,
    backup_codes: setup.hashedBackupCodes,
    enabled: false,
  })

  if (error) {
    return NextResponse.json(
      { error: "Failed to save 2FA secret" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    secret: setup.secret,
    qrCode: setup.qrCode,
    uri: setup.uri,
    backupCodes: setup.backupCodes,
  })
})
