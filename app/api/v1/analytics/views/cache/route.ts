import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from '@/lib/auth/server-auth'
import { getScoringCache } from '@/lib/analytics/materialized-views'

// Looking up another organization's score by ID is a cross-tenant read,
// so this is platform-admin only, same as the views list/refresh above.
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId query parameter is required' },
        { status: 400 }
      )
    }

    const cache = await getScoringCache(workspaceId)
    if (!cache) {
      return NextResponse.json({ error: 'No scores found for that organization' }, { status: 404 })
    }
    return NextResponse.json({ success: true, cache })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId query parameter is required' },
        { status: 400 }
      )
    }

    // Scores are now computed live from digit_scores on every lookup --
    // there is no cache layer left to invalidate.
    return NextResponse.json({ success: true, message: 'Scores are computed live; there is no cache to invalidate.' })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
