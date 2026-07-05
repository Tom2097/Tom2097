import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getRetentionPolicy, getRetentionHistory, saveRetentionPolicy, runRetentionCleanup } from '@/lib/audit/retention'

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const policies = await getRetentionPolicy(organizationId)
    const history = await getRetentionHistory(organizationId)

    return NextResponse.json({
      success: true,
      policies,
      history
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { action, policies } = await request.json()

    if (action === 'save') {
      const success = await saveRetentionPolicy(organizationId, policies)
      return NextResponse.json({ success })
    }

    if (action === 'run') {
      const result = await runRetentionCleanup(organizationId)
      return NextResponse.json({
        success: result.success,
        deletedCount: result.deletedCount,
        error: result.error
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    return handleAuthError(error as Error)
  }
}