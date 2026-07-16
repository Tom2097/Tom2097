import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

const NOTIFICATION_TYPE: Record<string, string> = {
  create_task: 'copilot_task',
  log_capa: 'copilot_capa',
  notify_team: 'copilot_alert',
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { action } = await request.json()

    if (!action?.type || !NOTIFICATION_TYPE[action.type]) {
      return NextResponse.json({ error: 'Unknown action type' }, { status: 400 })
    }

    const db = createServiceClient()

    if (action.type === 'log_capa') {
      const { createCapa } = await import('@/lib/compliance/capa')
      const capa = await createCapa(organizationId, {
        title: action.label || 'Copilot-suggested action',
        description: action.details || '',
        source: 'copilot',
        severity: 'minor',
      }, user.id)
      if (!capa) return NextResponse.json({ error: 'Failed to log CAPA' }, { status: 500 })
      return NextResponse.json({ success: true, capaId: capa.id })
    }

    const { error } = await db.from('notifications').insert({
      organization_id: organizationId,
      type: NOTIFICATION_TYPE[action.type],
      title: action.label || 'Copilot action',
      data: { details: action.details ?? null, triggered_by: user.id },
    })

    if (error) {
      return NextResponse.json({ error: 'Failed to execute action' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
