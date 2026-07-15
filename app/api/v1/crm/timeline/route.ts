import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { addTimelineEntry, listTimeline } from '@/lib/crm/extensions'
import type { CrmEntityType, TimelineEntry } from '@/lib/crm/types'

function toEvent(entry: TimelineEntry) {
  return {
    id: entry.id,
    type: entry.entry_type,
    title: entry.title,
    description: entry.description,
    timestamp: entry.occurred_at,
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const { entries } = await listTimeline(organizationId, {
      entityId: searchParams.get('entityId') || undefined,
      entityType: (searchParams.get('entityType') as CrmEntityType) || undefined,
      limit: Number(searchParams.get('limit')) || 20,
    })
    return NextResponse.json({ entries: entries.map(toEvent) })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { entityId, entityType, title, description } = await request.json()
    if (!entityId || !entityType || !title) {
      return NextResponse.json({ error: 'entityId, entityType, and title are required' }, { status: 400 })
    }

    const entry = await addTimelineEntry(organizationId, user.id, {
      entity_id: entityId,
      entity_type: entityType,
      entry_type: 'note',
      title,
      description: description || null,
    })
    return NextResponse.json(toEvent(entry), { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
