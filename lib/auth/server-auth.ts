import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function getAuthenticatedUser() {
  const supabase = await createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  return user
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
  console.error('Auth Error:', error)
  return NextResponse.json(
    { error: 'Internal Server Error' },
    { status: 500 }
  )
}