import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { canCreateTenant } from "@/lib/platform/capacity-service"
import { isPlatformOwnerEmail } from "@/lib/platform/owner"
import type { EmailOtpType, User } from "@supabase/supabase-js"
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

  // Invited team members join the inviter's existing organization instead
  // of getting a brand-new one -- see invited_organization_id/invited_role
  // set on the user by app/api/v1/auth/invite/route.ts's inviteUserByEmail
  // call.
  const invitedOrganizationId = user.user_metadata?.invited_organization_id as string | undefined
  if (invitedOrganizationId) {
    const { error: profileError } = await db
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        full_name: (user.user_metadata?.full_name || "") as string,
        organization_id: invitedOrganizationId,
        role: (user.user_metadata?.invited_role as string) || "member",
      })

    if (profileError) {
      console.error("[auth] Failed to create profile for invited user:", { error: profileError })
      return buildRedirect(`/auth/error?reason=${encodeURIComponent("Failed to join organization")}`)
    }
    return
  }

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
      // Signup confirmation establishes a session as a side effect of
      // verifying the token, but the user never went through a deliberate
      // login step -- and since this link is often opened on a different
      // device/browser than the one they intend to actually use, sign them
      // out here and have them log in properly rather than silently
      // landing them in the dashboard on whatever device confirmed it.
      if (type === "signup") {
        await supabase.auth.signOut()
        return buildRedirect("/auth/login?confirmed=true")
      }
      // Invited users have no password yet -- keep the session (like
      // recovery) and send them to set one, same as a password reset.
      if (type === "invite") {
        return buildRedirect("/auth/reset-password")
      }
      return buildRedirect(next)
    }
    console.error("[v0] verifyOtp failed:", { error: error.message })
    return buildRedirect(`/auth/error?reason=${encodeURIComponent(error.message)}`)
  }

  return buildRedirect("/auth/error?reason=missing_verification_token")
}
