import { NextResponse } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const db = createServiceClient()
    const { data, error } = await db
      .from('workspaces')
      .select('id, name, vertical')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[v1/workspaces] list failed:', error)
      return NextResponse.json({ error: 'Failed to list workspaces' }, { status: 500 })
    }

    return NextResponse.json({ workspaces: data ?? [] })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
