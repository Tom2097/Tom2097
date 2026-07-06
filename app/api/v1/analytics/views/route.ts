import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getMaterializedViews, refreshView, refreshAllViews } from '@/lib/analytics/materialized-views'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    await getOrganizationId(user.id)

    const views = getMaterializedViews()
    return NextResponse.json({ success: true, views })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await getOrganizationId(user.id)

    const { name } = await request.json()

    if (name === 'all') {
      const results = refreshAllViews()
      return NextResponse.json({ success: true, results })
    }

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    const result = refreshView(name)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
