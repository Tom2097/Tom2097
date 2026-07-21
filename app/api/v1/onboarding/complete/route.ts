import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAuthenticatedUser, handleAuthError } from '@/lib/auth/server-auth'

function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return `${base || 'org'}-${Math.random().toString(36).slice(2, 8)}`
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const data = await request.json()
    const {
      fullName, email, phone,
      companyName, companyRegistrationNumber, companyWebsite, companyAddress, companyCountry,
      role, position,
    } = data as {
      fullName?: string; email?: string; phone?: string
      companyName?: string; companyRegistrationNumber?: string; companyWebsite?: string
      companyAddress?: string; companyCountry?: string
      role?: string; position?: string
    }

    if (!companyName) {
      return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
    }
    if (email && user.email && email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Email does not match the authenticated account' }, { status: 403 })
    }

    const db = createServiceClient()

    // The service-role client bypasses RLS, so profile ownership must come
    // exclusively from the verified session rather than a caller-supplied email.
    const { data: profile } = await db
      .from('profiles')
      .select('id, organization_id, onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile) {
      return NextResponse.json({ error: 'No profile found for the authenticated account' }, { status: 404 })
    }
    // profiles.onboarding_completed_at is the one real "onboarding is done"
    // signal used across both onboarding paths (see
    // app/api/v1/onboarding/recommendations's "complete" action, which sets
    // it for the /onboarding questionnaire flow). organization_id being set
    // is not a valid proxy for that here: invited users and every self-signup
    // (app/auth/callback/route.ts's ensureUserProfile) now get an
    // organization_id long before this KYC flow could ever run, so that
    // check meant this endpoint could never succeed for anyone.
    if (profile.onboarding_completed_at) {
      return NextResponse.json({ error: 'Onboarding has already been completed' }, { status: 409 })
    }

    const { data: org, error: orgError } = await db
      .from('organizations')
      .insert({
        name: companyName,
        slug: slugify(companyName),
        registration_number: companyRegistrationNumber || null,
        website: companyWebsite || null,
        address: companyAddress || null,
        country: companyCountry || null,
      })
      .select('id')
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
    }

    const { data: updatedProfile, error: profileError } = await db
      .from('profiles')
      .update({
        full_name: fullName || null,
        phone: phone || null,
        role: role === 'owner' || role === 'admin' ? role : 'member',
        organization_id: org.id,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
      // Same field the upfront 409 check above reads -- keeping the atomic
      // condition on onboarding_completed_at (rather than organization_id)
      // means a concurrent completion of this same request can't leave this
      // request's just-created organization orphaned: if another request
      // already set the flag, zero rows match and the org gets cleaned up
      // below instead.
      .is('onboarding_completed_at', null)
      .select('id')
      .maybeSingle()

    if (profileError || !updatedProfile) {
      // Don't orphan the organization row just created above -- either the
      // update genuinely failed, or a concurrent completion already set
      // onboarding_completed_at first (see the .is() filter above), in which
      // case this request's org was never actually assigned to anyone.
      const { error: cleanupError } = await db.from('organizations').delete().eq('id', org.id)
      if (cleanupError) {
        console.error('[onboarding/complete] failed to clean up orphaned organization:', cleanupError.message)
      }
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true, organizationId: org.id, position: position ?? null })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
