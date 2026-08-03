import { NextResponse } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

// DELETE /api/v1/workspaces/[id]
// Workspaces can be created (app/api/v1/configure/save) and listed
// (app/api/v1/workspaces) but had no way to be removed -- the Configure
// page's cards only offered Open/Reconfigure. Nothing else in the schema
// references workspaces.id (no FK constraints), so this is a plain scoped
// delete.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const db = createServiceClient()
    const { data, error } = await db
      .from('workspaces')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[v1/workspaces/[id]] delete failed:', error)
      return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
