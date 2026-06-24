import { NextRequest, NextResponse } from "next/server"
import { sendMagicLink } from "@/lib/auth/passwordless/service"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 })
    }

    await sendMagicLink({ email })
    return NextResponse.json({ success: true, message: "Magic link sent if account exists" })
  } catch (err) {
    console.error("[passwordless] Send error:", err)
    return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 })
  }
}
