import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createTask, listTasks, updateTask, deleteTask } from '@/lib/crm/extensions'
import type { CrmTask, TaskPriority, TaskStatus } from '@/lib/crm/types'

function toItem(task: CrmTask) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    due_at: task.due_at,
    assigned_to: task.assigned_to,
    entity: task.entity_type,
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const { tasks } = await listTasks(organizationId, {
      status: (searchParams.get('status') as TaskStatus) || undefined,
      priority: (searchParams.get('priority') as TaskPriority) || undefined,
      entityId: searchParams.get('entityId') || undefined,
      limit: Number(searchParams.get('limit')) || 100,
    })
    return NextResponse.json({ tasks: tasks.map(toItem) })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const input = await request.json()
    if (!input.title || typeof input.title !== 'string' || !input.title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const task = await createTask(organizationId, user.id, input)
    return NextResponse.json(toItem(task), { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = await request.json()
    const task = await updateTask(organizationId, id, body)
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    return NextResponse.json(toItem(task))
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const ok = await deleteTask(organizationId, id)
    if (!ok) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
