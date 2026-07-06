import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getPendingApprovals, autoAssignFindings } from '@/lib/intelligence/agents'
import { approveAction, executeAction } from '@/lib/intelligence/engine'

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const actions = await getPendingApprovals(organizationId)
    return NextResponse.json({ actions })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const body = await request.json().catch(() => ({}))
    const { action, actionId } = body

    if (action === 'auto-assign') {
      const actions = await autoAssignFindings(organizationId)
      return NextResponse.json({ success: true, actions })
    }

    if (action === 'approve' && actionId) {
      const approved = await approveAction(actionId, organizationId)
      if (!approved) {
        return NextResponse.json(
          { error: 'Failed to approve action' },
          { status: 500 }
        )
      }
      // Attempt to execute immediately after approval
      await executeAction(actionId, organizationId)
      const actions = await getPendingApprovals(organizationId)
      return NextResponse.json({ success: true, actions })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
