import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getScoringCache, invalidateScoringCache } from '@/lib/analytics/materialized-views'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await getOrganizationId(user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId query parameter is required' },
        { status: 400 }
      )
    }

    const cache = getScoringCache(workspaceId)
    return NextResponse.json({ success: true, cache })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await getOrganizationId(user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId query parameter is required' },
        { status: 400 }
      )
    }

    invalidateScoringCache(workspaceId)
    return NextResponse.json({ success: true, message: `Cache invalidated for workspace ${workspaceId}` })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
