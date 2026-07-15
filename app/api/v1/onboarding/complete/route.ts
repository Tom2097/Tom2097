import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return `${base || 'org'}-${Math.random().toString(36).slice(2, 8)}`
}

export async function POST(request: NextRequest) {
  try {
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

    if (!email || !companyName) {
      return NextResponse.json({ error: 'email and companyName are required' }, { status: 400 })
    }

    const db = createServiceClient()

    const { data: profile } = await db.from('profiles').select('id').eq('email', email.toLowerCase()).maybeSingle()
    if (!profile) {
      return NextResponse.json({ error: 'No account found for this email. Please verify your passcode again.' }, { status: 404 })
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

    const { error: profileError } = await db
      .from('profiles')
      .update({
        full_name: fullName || null,
        phone: phone || null,
        role: role || 'member',
        organization_id: org.id,
      })
      .eq('id', profile.id)

    if (profileError) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true, organizationId: org.id, position: position ?? null })
  } catch {
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 })
  }
}
