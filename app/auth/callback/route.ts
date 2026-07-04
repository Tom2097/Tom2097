import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { canCreateTenant } from "@/lib/platform/capacity-service"
import { isPlatformOwnerEmail } from "@/lib/platform/owner"
import type { EmailOtpType, User } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

async function ensureUserProfile(
  user: User,
  db: ReturnType<typeof createServiceClient>,
  buildRedirect: (path: string) => NextResponse,
) {
  const { data: existingProfile } = await db
    .from("profiles")
    .select("id, organization_id")
    .eq("id", user.id)
    .maybeSingle()

  if (existingProfile) return

  if (!isPlatformOwnerEmail(user.email)) {
    const cap = await canCreateTenant()
  if (!cap.allowed) {
    console.warn("[v0] tenant cap reached:", { used: cap.used, limit: cap.limit })
    return buildRedirect("/auth/error?reason=platform_at_capacity")
  }
  }

  const { data: org, error: orgError } = await db
    .from("organizations")
    .insert({
      name: (user.user_metadata?.company_name || user.email?.split("@")[0]) as string,
      slug: `org-${user.id.slice(0, 8)}`,
    })
    .select("id")
    .single()

  if (orgError || !org) {
    console.error("[auth] Failed to create organization:", { error: orgError })
    return buildRedirect(`/auth/error?reason=${encodeURIComponent("Failed to create organization")}`)
  }

  const { error: profileError } = await db
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      full_name: (user.user_metadata?.full_name || "") as string,
      organization_id: org.id,
      role: "admin",
    })

  if (profileError) {
    console.error("[auth] Failed to create profile:", { error: profileError })
    return buildRedirect(`/auth/error?reason=${encodeURIComponent("Failed to create profile")}`)
  }

  const { error: subError } = await db
    .from("subscriptions")
    .insert({
      organization_id: org.id,
      plan_id: "free",
      status: "incomplete",
    })

  if (subError) {
    console.error("[auth] Failed to create subscription:", { error: subError })
  }
}

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
  const db = createServiceClient()

  // PKCE flow: exchange the auth code for a session
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        try {
          const result = await ensureUserProfile(user, db, buildRedirect)
          if (result instanceof NextResponse) return result
          } catch (err) {
            console.error("[auth] Post-signup profile creation failed:", err)
          }
      }
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
      if (user) {
        try {
          const result = await ensureUserProfile(user, db, buildRedirect)
          if (result instanceof NextResponse) return result
          } catch (err) {
            console.error("[auth] Post-OTP profile creation failed:", err)
          }
      }
      return buildRedirect(next)
    }
    console.error("[v0] verifyOtp failed:", { error: error.message })
    return buildRedirect(`/auth/error?reason=${encodeURIComponent(error.message)}`)
  }

  return buildRedirect("/auth/error?reason=missing_verification_token")
}
