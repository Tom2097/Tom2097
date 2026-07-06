import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { executeAction } from '@/lib/intelligence/engine'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const body = await request.json().catch(() => ({}))
    const { actionId } = body

    if (!actionId) {
      return NextResponse.json(
        { error: 'actionId is required' },
        { status: 400 }
      )
    }

    const success = await executeAction(actionId, organizationId)
    return NextResponse.json({ success })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
