import { createServiceClient } from "@/lib/supabase/service"
import { canCreateTenant } from "@/lib/platform/capacity-service"
import { isPlatformOwnerEmail } from "@/lib/platform/owner"
import { getValidatedPlanId } from "@/lib/products"
import { TRIAL_DAYS } from "@/lib/billing/constants"
import type { User } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export type EnsureProfileResult =
  | { errorResponse: NextResponse; needsOnboarding?: undefined }
  | { errorResponse?: undefined; needsOnboarding: boolean }

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505"
}

/**
 * Creates the profile (and organization, for a brand-new self-signup) for a
 * just-authenticated Supabase user, if one doesn't already exist. Shared by
 * every session-establishing entry point -- the PKCE/OTP redirect callback
 * (app/auth/callback/route.ts) and the ID-token sign-in route
 * (app/api/auth/google-post-signin/route.ts) -- so a new user gets the same
 * org/profile/trial regardless of which flow authenticated them.
 *
 * `onError` builds whatever failure response is appropriate for the caller
 * (a redirect for the browser-navigated callback route, a JSON error for the
 * fetch-based ID-token route).
 */
export async function ensureUserProfile(
  user: User,
  onError: (reason: string) => NextResponse,
): Promise<EnsureProfileResult> {
  const db = createServiceClient()
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
      return { errorResponse: onError("Failed to join organization") }
    }
    return { needsOnboarding: false }
  }

  if (!isPlatformOwnerEmail(user.email)) {
    const cap = await canCreateTenant()
    if (!cap.allowed) {
      console.warn("[v0] tenant cap reached:", { used: cap.used, limit: cap.limit })
      return { errorResponse: onError("platform_at_capacity") }
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
    return { errorResponse: onError("Failed to create organization") }
  }

  // Brand-new self-signups create their own organization, which makes them
  // its Owner (billing, deletion, promoting/demoting Admins, transferring
  // ownership -- see supabase/migrations/20260825000000_owner_role.sql).
  // Invited users never hit this path -- they join an existing org above
  // with whatever role the inviter picked (admin/member/viewer; owner is
  // never invited-as).
  //
  // onboarding_completed_at is set immediately, same as invited users get
  // above -- the questionnaire wizard used to be a mandatory gate here, but
  // it added 3+ extra screens (including an "identity verification" step
  // asking for a government ID) between signup and actually seeing the
  // product, which is exactly the kind of friction a self-serve trial can't
  // afford. app/onboarding/* still exists and works if someone navigates to
  // it manually; it's just no longer forced.
  const { error: profileError } = await db
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      full_name: (user.user_metadata?.full_name || "") as string,
      organization_id: org.id,
      role: "owner",
      onboarding_completed_at: new Date().toISOString(),
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

    // Any other failure (not the two-tabs race handled above) still leaves
    // an org with no owner -- roll it back rather than orphaning it.
    const { error: cleanupError } = await db.from("organizations").delete().eq("id", org.id)
    if (cleanupError) {
      console.error("[auth] Failed to clean up orphaned organization after profile error:", { error: cleanupError })
    }
    console.error("[auth] Failed to create profile:", { error: profileError })
    return { errorResponse: onError("Failed to create profile") }
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

  return { needsOnboarding: false }
}
