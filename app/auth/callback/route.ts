import { createClient } from "@/lib/supabase/server"
import { ensureUserProfile } from "@/lib/auth/ensure-profile"
import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export function sanitizeCallbackPath(path: string | null): string {
  if (!path) return "/"
  const normalized = path.replace(/\\/g, "/")
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return "/"
  return normalized
}

export function getCallbackOrigin(request: Request): string | null {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin
    } catch {
      return null
    }
  }

  // Request origins are acceptable for local development only. In production,
  // proxy forwarding headers are caller-controlled unless the complete proxy
  // chain is configured perfectly, so a missing canonical URL must fail closed.
  return process.env.NODE_ENV === "development" ? new URL(request.url).origin : null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = sanitizeCallbackPath(searchParams.get("next"))
  const callbackOrigin = getCallbackOrigin(request)

  if (!callbackOrigin) {
    console.error("[auth] Missing or invalid canonical site URL for callback")
    return NextResponse.json({ error: "Authentication callback is unavailable" }, { status: 503 })
  }

  const buildRedirect = (path: string) => {
    return NextResponse.redirect(new URL(sanitizeCallbackPath(path), callbackOrigin))
  }
  const buildErrorRedirect = (reason: string) => buildRedirect(`/auth/error?reason=${encodeURIComponent(reason)}`)

  const supabase = await createClient()

  // PKCE flow: exchange the auth code for a session
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      let needsOnboarding = false
      if (user) {
        try {
          const result = await ensureUserProfile(user, buildErrorRedirect)
          if (result.errorResponse) return result.errorResponse
          needsOnboarding = result.needsOnboarding
        } catch (err) {
          console.error("[auth] Post-signup profile creation failed:", err)
        }
      }
      // Brand-new (non-invited) signups get the industry/goals questionnaire
      // before the dashboard; app/(dashboard)/page.tsx re-checks the same
      // flag as a safety net for flows that can't redirect here directly
      // (see the OTP signup branch below).
      if (needsOnboarding) return buildRedirect("/onboarding")
      return buildRedirect(next)
    }
    console.error("[v0] exchangeCodeForSession failed:", { error: error.message })
    return buildRedirect(`/auth/error?reason=${encodeURIComponent(error.message)}`)
  }

  // OTP / magic-link flow: verify the token hash
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      let needsOnboarding = false
      if (user) {
        try {
          const result = await ensureUserProfile(user, buildErrorRedirect)
          if (result.errorResponse) return result.errorResponse
          needsOnboarding = result.needsOnboarding
        } catch (err) {
          console.error("[auth] Post-OTP profile creation failed:", err)
        }
      }
      // Signup confirmation establishes a session as a side effect of
      // verifying the token. Every mainstream self-serve product (Vercel,
      // Linear, Stripe, ...) lands you straight in the app from this click
      // rather than forcing a second manual email+password entry -- keep
      // the session and go straight to the dashboard instead of signing
      // out. (The forced-relogin theory was that this link is sometimes
      // opened on a different device than the one you signed up on, but
      // that's the uncommon case, and it cost every single self-signup an
      // extra full page + manual login to protect against it.)
      // Invited users have no password yet -- keep the session (like
      // recovery) and send them to set one, same as a password reset.
      if (type === "invite") {
        return buildRedirect("/auth/reset-password")
      }
      if (needsOnboarding) return buildRedirect("/onboarding")
      return buildRedirect(next)
    }
    console.error("[v0] verifyOtp failed:", { error: error.message })
    return buildRedirect(`/auth/error?reason=${encodeURIComponent(error.message)}`)
  }

  return buildRedirect("/auth/error?reason=missing_verification_token")
}
