import { withAuth } from "@/lib/auth/with-auth"
import { verifyTOTPCode } from "@/lib/auth/2fa"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

export const POST = withAuth(async (req, { userId }) => {
  const { code } = await req.json()

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Verification code is required" }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: record } = await supabase
    .from("user_2fa")
    .select("secret")
    .eq("user_id", userId)
    .single()

  if (!record) {
    return NextResponse.json({ error: "2FA not set up" }, { status: 404 })
  }

  const { valid } = verifyTOTPCode(record.secret, code)
  if (!valid) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 })
  }

  await supabase.from("user_2fa").delete().eq("user_id", userId)

  return NextResponse.json({ success: true })
})
