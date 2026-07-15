import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { isPlatformAdmin } from '@/lib/auth/rbac'

export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
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
  console.error('Auth Error:', error)
  return NextResponse.json(
    { error: 'Internal Server Error' },
    { status: 500 }
  )
}