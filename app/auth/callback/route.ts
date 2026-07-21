import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { canCreateTenant } from "@/lib/platform/capacity-service"
import { isPlatformOwnerEmail } from "@/lib/platform/owner"
import { getValidatedPlanId } from "@/lib/products"
// Import from the small shared constants module rather than
// subscription-lifecycle.ts directly -- that module is marked 'server-only'
// and this route (and its test suite, __tests__/auth-callback.test.ts) must
// stay importable without pulling that guard in.
import { TRIAL_DAYS } from "@/lib/billing/constants"
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

type EnsureProfileResult =
  | { redirect: NextResponse; needsOnboarding?: undefined }
  | { redirect?: undefined; needsOnboarding: boolean }

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505"
}

async function ensureUserProfile(
  user: User,
  db: ReturnType<typeof createServiceClient>,
  buildRedirect: (path: string) => NextResponse,
): Promise<EnsureProfileResult> {
  const { data: existingProfile } = await db
    .from("profiles")
    .select("id, organization_id, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle()

  if (existingProfile) {
    return { needsOnboarding: !existingProfile.onboarding_completed_at }
  }

  // Invited team members join the inviter's existing organization instead
  // of getting a brand-new one -- see invited_organization_id/invited_role
  // set on the user by app/api/v1/auth/invite/route.ts's inviteUserByEmail
  // call. They're joining an already-onboarded org, so they never see the
  // industry/goals questionnaire the way a brand-new self-signup does.
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
        onboarding_completed_at: new Date().toISOString(),
      })

    if (profileError) {
      // The same invite-confirmation link opened twice (two tabs/devices)
      // can race here -- profiles.id is the PK (= auth.users.id), so only one
      // insert wins. The loser isn't a real failure: the account exists
      // fine, created by the concurrent request. Proceed as if this request
      // had found it originally instead of showing a hard error.
      if (isUniqueViolation(profileError)) {
        return { needsOnboarding: false }
      }
      console.error("[auth] Failed to create profile for invited user:", { error: profileError })
      return { redirect: buildRedirect(`/auth/error?reason=${encodeURIComponent("Failed to join organization")}`) }
    }
    return { needsOnboarding: false }
  }

  if (!isPlatformOwnerEmail(user.email)) {
    const cap = await canCreateTenant()
    if (!cap.allowed) {
      console.warn("[v0] tenant cap reached:", { used: cap.used, limit: cap.limit })
      return { redirect: buildRedirect("/auth/error?reason=platform_at_capacity") }
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
    return { redirect: buildRedirect(`/auth/error?reason=${encodeURIComponent("Failed to create organization")}`) }
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
    // Two tabs/devices opening the same email-confirmation link at once can
    // both pass the "no existing profile" check above before either commits.
    // Each creates its own organizations row, but only one profile insert
    // can win (id is the PK = auth.users.id). Detect that here: clean up the
    // org this request just created (don't orphan it), then read back the
    // profile the *other* request created and proceed exactly as if this
    // request had found it originally -- no hard failure for the loser.
    if (isUniqueViolation(profileError)) {
      const { error: cleanupError } = await db.from("organizations").delete().eq("id", org.id)
      if (cleanupError) {
        console.error("[auth] Failed to clean up orphaned organization after profile race:", { error: cleanupError })
      }

      const { data: winnerProfile } = await db
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", user.id)
        .maybeSingle()

      if (winnerProfile) {
        return { needsOnboarding: !winnerProfile.onboarding_completed_at }
      }
    }
    console.error("[auth] Failed to create profile:", { error: profileError })
    return { redirect: buildRedirect(`/auth/error?reason=${encodeURIComponent("Failed to create profile")}`) }
  }

  // The plan a visitor picked on the pricing/checkout page rides along as
  // selected_plan_id in user_metadata (see app/api/auth/sign-up/route.ts).
  // Never trust it blindly -- re-validate against the real plan catalog.
  // Matches TRIAL_DAYS from lib/billing/subscription-lifecycle.ts's
  // startTrial() so the trial length is consistent everywhere rather than a
  // second, possibly-diverging hardcoded number.
  const planId = getValidatedPlanId(user.user_metadata?.selected_plan_id)
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { error: subError } = await db
    .from("subscriptions")
    .insert({
      organization_id: org.id,
      plan_id: planId,
      status: "trialing",
      trial_ends_at: trialEndsAt,
    })

  if (subError) {
    console.error("[auth] Failed to create subscription:", { error: subError })
  }

  return { needsOnboarding: true }
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
      let needsOnboarding = false
      if (user) {
        try {
          const result = await ensureUserProfile(user, db, buildRedirect)
          if (result.redirect) return result.redirect
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
          const result = await ensureUserProfile(user, db, buildRedirect)
          if (result.redirect) return result.redirect
          needsOnboarding = result.needsOnboarding
        } catch (err) {
          console.error("[auth] Post-OTP profile creation failed:", err)
        }
      }
      // Signup confirmation establishes a session as a side effect of
      // verifying the token, but the user never went through a deliberate
      // login step -- and since this link is often opened on a different
      // device/browser than the one they intend to actually use, sign them
      // out here and have them log in properly rather than silently
      // landing them in the dashboard on whatever device confirmed it. This
      // is also why a brand-new signup can't be routed to /onboarding right
      // here -- there's no session left to carry them there. Instead
      // app/(dashboard)/page.tsx checks the same onboarding_completed_at
      // flag on their next real, authenticated login and redirects them then.
      if (type === "signup") {
        await supabase.auth.signOut()
        return buildRedirect("/auth/login?confirmed=true")
      }
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
