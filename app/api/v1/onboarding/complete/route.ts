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
      .select('id, organization_id')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile) {
      return NextResponse.json({ error: 'No profile found for the authenticated account' }, { status: 404 })
    }
    if (profile.organization_id) {
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
      })
      .eq('id', profile.id)
      .is('organization_id', null)
      .select('id')
      .maybeSingle()

    if (profileError || !updatedProfile) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true, organizationId: org.id, position: position ?? null })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
