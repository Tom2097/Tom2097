import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from '@/lib/auth/server-auth'
import { getMaterializedViews, refreshView, refreshAllViews } from '@/lib/analytics/materialized-views'

// These views aggregate digit_scores across every organization, so refreshing
// or listing them is a platform-wide operation, not a per-tenant one.
export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)

    const views = await getMaterializedViews()
    return NextResponse.json({ success: true, views })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)

    const { name } = await request.json()

    if (name === 'all') {
      const results = await refreshAllViews()
      return NextResponse.json({ success: true, results })
    }

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    const result = await refreshView(name)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
