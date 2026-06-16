import { createClient } from "@/lib/supabase/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/"

  const buildRedirect = (path: string) => {
    const forwardedHost = request.headers.get("x-forwarded-host")
    const isLocalEnv = process.env.NODE_ENV === "development"
    if (!isLocalEnv && forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${path}`)
    }
    return NextResponse.redirect(`${origin}${path}`)
  }

  const supabase = await createClient()

  // PKCE flow: exchange the auth code for a session
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return buildRedirect(next)
    }
    console.log("[v0] exchangeCodeForSession failed:", error.message)
    return buildRedirect(`/auth/error?reason=${encodeURIComponent(error.message)}`)
  }

  // OTP / magic-link flow: verify the token hash
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return buildRedirect(next)
    }
    console.log("[v0] verifyOtp failed:", error.message)
    return buildRedirect(`/auth/error?reason=${encodeURIComponent(error.message)}`)
  }

  // No code or token present — nothing to verify
  return buildRedirect("/auth/error?reason=missing_verification_token")
}
