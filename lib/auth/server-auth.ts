import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { isPlatformAdmin } from '@/lib/auth/rbac'
import { isCurrentUserPlatformOwner } from '@/lib/platform/owner'

export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

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
    .select('status')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.status === 'suspended') {
    throw new Error('Suspended')
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
  console.error('Auth Error:', error)
  return NextResponse.json(
    { error: 'Internal Server Error' },
    { status: 500 }
  )
}