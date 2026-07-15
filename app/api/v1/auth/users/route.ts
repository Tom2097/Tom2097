import { NextResponse } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', organizationId)
      .order('full_name', { ascending: true })

    if (error) {
      console.error('[auth/users] Error fetching org members:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    return NextResponse.json((data ?? []).map((p) => ({ id: p.id, name: p.full_name ?? p.email ?? 'Unnamed', email: p.email })))
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
