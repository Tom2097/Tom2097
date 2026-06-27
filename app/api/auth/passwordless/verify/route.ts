import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get("token")
    const email = url.searchParams.get("email")

    if (!token || !email) {
      return NextResponse.redirect(new URL("/auth/login?error=invalid_link", request.url))
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "magiclink" })

    if (error) {
      return NextResponse.redirect(new URL("/auth/login?error=invalid_or_expired", request.url))
    }

    return NextResponse.redirect(new URL("/dashboard", request.url))
  } catch (err) {
    console.error("[passwordless] Verify error:", err)
    return NextResponse.redirect(new URL("/auth/login?error=verification_failed", request.url))
  }
}
