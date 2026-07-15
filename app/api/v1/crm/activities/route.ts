import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { logActivity, listActivities, validateActivity } from '@/lib/crm/engine'
import type { ActivityType, CrmEntityType } from '@/lib/crm/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const { activities, total } = await listActivities(organizationId, {
      entityType: (searchParams.get('entityType') as CrmEntityType) || undefined,
      entityId: searchParams.get('entityId') || undefined,
      type: (searchParams.get('type') as ActivityType) || undefined,
      limit: Number(searchParams.get('limit')) || 50,
    })
    return NextResponse.json({ activities, total })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const input = await request.json()
    const validationError = validateActivity(input)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

    const activity = await logActivity(organizationId, user.id, input)
    if (!activity) return NextResponse.json({ error: 'Referenced entity not found' }, { status: 404 })
    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
