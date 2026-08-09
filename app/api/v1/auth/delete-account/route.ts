import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { executeDsarDelete } from '@/lib/compliance/dsar'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const body = await request.json().catch(() => ({}))
    if (body.confirmation !== 'DELETE') {
      return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
    }

    const db = createServiceClient()
    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // A sole owner deleting their account while teammates remain would
    // orphan the org (no one left who can manage billing/roles) -- make
    // them transfer ownership first, same as the existing UI's transfer
    // flow already requires before letting an owner leave the team.
    if (profile?.role === 'owner') {
      const { count } = await db
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .neq('id', user.id)

      if ((count ?? 0) > 0) {
        return NextResponse.json(
          { error: 'Transfer ownership to another team member before deleting your account' },
          { status: 400 },
        )
      }
    }

    await executeDsarDelete(organizationId, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
