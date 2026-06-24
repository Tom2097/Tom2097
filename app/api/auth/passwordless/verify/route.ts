import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { verifyMagicLink } from "@/lib/auth/passwordless/service"

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get("token")
    const email = url.searchParams.get("email")

    if (!token || !email) {
      return NextResponse.redirect(new URL("/auth/login?error=invalid_link", request.url))
    }

    const userId = await verifyMagicLink(token, email)
    if (!userId) {
      return NextResponse.redirect(new URL("/auth/login?error=invalid_or_expired", request.url))
    }

    const supabase = await createServiceClient()
    const { data: session } = await supabase.auth.admin.createSession({ user_id: userId })
    const sessionCookie = `sb-session=${session?.id || ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`

    const redirect = new URL("/dashboard", request.url)
    const res = NextResponse.redirect(redirect)
    res.headers.set("Set-Cookie", sessionCookie)
    return res
  } catch (err) {
    console.error("[passwordless] Verify error:", err)
    return NextResponse.redirect(new URL("/auth/login?error=verification_failed", request.url))
  }
}
