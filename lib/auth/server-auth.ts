import { createClient, getBearerToken } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { isPlatformAdmin } from '@/lib/auth/rbac'
import { isCurrentUserPlatformOwner } from '@/lib/platform/owner'
import { expireTrialIfDue } from '@/lib/billing/subscription-lifecycle'

export async function getAuthenticatedUser() {
  const supabase = await createClient()
  // A native mobile client (no cookies) presents its Supabase access token
  // as a Bearer header instead -- validate that specific token if present,
  // otherwise fall back to the cookie-based browser session.
  const bearerToken = await getBearerToken()
  const { data: { user }, error } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  // A valid Supabase JWT alone isn't enough -- admin "suspend user" (see
  // app/api/v1/admin/users/route.ts) only ever wrote profiles.status, which
  // nothing on the request path checked. Reject suspended profiles here so
  // suspension actually blocks access instead of just flipping a flag that
  // nothing reads.
  const serviceDb = createServiceClient()
  const { data: profile } = await serviceDb
    .from('profiles')
    .select('status, organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.status === 'suspended') {
    throw new Error('Suspended')
  }

  // Same idea as the suspended-profile check above: startTrial() writes a
  // "trialing" subscription with a trial_ends_at, but historically nothing
  // on the request path ever moved it past that once the trial period
  // elapsed -- every trial granted full paid access forever. This is the
  // request-time safety net that catches it for any org making an
  // authenticated request; app/api/v1/billing/trials/run-due/route.ts is the
  // scheduled sweep for orgs that don't. Failures here must never block
  // login/auth for an unrelated request, so they're swallowed and logged.
  if (profile?.organization_id) {
    try {
      await expireTrialIfDue(profile.organization_id)
    } catch (err) {
      console.error('[auth] Failed to check trial expiry:', err)
    }
  }

  return user
}

/** Throws 'Forbidden' (via handleAuthError) unless the given user is a platform admin. */
export async function requirePlatformAdmin(userId: string) {
  const isAdmin = await isPlatformAdmin(userId)
  if (!isAdmin) {
    throw new Error('Forbidden')
  }
}

// Two independent admin surfaces share some of the same API routes: the
// legacy /admin/* console (gated by profiles.role === 'platform_admin', a
// DB-role flag) and the founder-only /platform/admin/* console (gated by
// PLATFORM_OWNER_EMAIL, an env allowlist -- see lib/platform/owner.ts). A
// founder passes their console's own page-level gate but has no
// platform_admin DB role, so requirePlatformAdmin alone 403s them on routes
// both consoles call. Accept either credential instead of picking one.
export async function requirePlatformAccess(userId: string) {
  const [isAdmin, isOwner] = await Promise.all([
    isPlatformAdmin(userId),
    isCurrentUserPlatformOwner(),
  ])
  if (!isAdmin && !isOwner) {
    throw new Error('Forbidden')
  }
}

// Owner is "whoever's actually paying" (founder spec): billing/subscription/
// payment actions (starting a subscription, changing plan, refunds,
// add-ons, trials) are owner-only. Admin keeps every other product
// permission (CRM, analytics, org settings, invites) -- only this narrow
// slice is restricted further than the existing admin-or-owner checks
// elsewhere (e.g. app/api/v1/auth/invite/route.ts).
export async function requireOwnerRole(userId: string) {
  const supabase = await createServiceClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    throw new Error('Organization not found')
  }

  if (profile.role !== 'owner') {
    throw new Error('OwnerRequired')
  }
}

export async function getOrganizationId(userId: string) {
  const supabase = await createServiceClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single()

  if (error || !profile?.organization_id) {
    throw new Error('Organization not found')
  }

  return profile.organization_id
}

export function handleAuthError(error: Error) {
  if (error.message === 'Unauthorized') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  if (error.message === 'Organization not found') {
    return NextResponse.json(
      { error: 'Organization not found' },
      { status: 404 }
    )
  }
  if (error.message === 'Forbidden') {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }
  if (error.message === 'Suspended') {
    return NextResponse.json(
      { error: 'Account suspended' },
      { status: 403 }
    )
  }
  if (error.message === 'OwnerRequired') {
    return NextResponse.json(
      { error: 'Only the organization owner can manage billing' },
      { status: 403 }
    )
  }
  console.error('Auth Error:', error)
  return NextResponse.json(
    { error: 'Internal Server Error' },
    { status: 500 }
  )
}