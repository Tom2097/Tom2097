import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { broadcast } from '@/lib/notifications/engine'

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

    if (action.type === 'create_task') {
      // The real Auto-Act flow (lib/operational/auto-create.ts) writes
      // document_tasks rows for classification-driven tasks; this mirrors
      // that for copilot-suggested ones, which have no source document, so
      // document_id is left null (document_tasks.document_id was made
      // nullable for exactly this case -- see migration
      // 20260816000000_operations_module_fixes.sql).
      const { data: task, error: taskError } = await db
        .from('document_tasks')
        .insert({
          organization_id: organizationId,
          document_id: null,
          task_type: 'copilot',
          task_id: null,
          auto_created: false,
          status: 'pending',
          title: action.label || 'Copilot-suggested task',
          description: action.details ?? null,
          assignee_id: null,
          due_date: null,
        })
        .select('id')
        .single()

      if (taskError || !task) {
        return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
      }
      return NextResponse.json({ success: true, taskId: task.id })
    }

    await broadcast(organizationId, {
      type: 'info',
      category: NOTIFICATION_TYPE[action.type],
      title: action.label || 'Copilot action',
      data: { details: action.details ?? null, triggered_by: user.id },
      source: 'app',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
