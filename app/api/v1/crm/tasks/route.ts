import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createTask, listTasks, updateTask, deleteTask } from "@/lib/crm/extensions"
import type { CrmTaskInput, CrmTaskUpdateInput } from "@/lib/crm/types"

export const GET = withAuth(async (req: NextRequest, { organizationId }) => {
  const { searchParams } = new URL(req.url)
  const result = await listTasks(organizationId, {
    status: searchParams.get("status") as any,
    priority: searchParams.get("priority") as any,
    assignedTo: searchParams.get("assignedTo") ?? undefined,
    entityType: searchParams.get("entityType") as any,
    entityId: searchParams.get("entityId") ?? undefined,
    limit: Number(searchParams.get("limit")) || 50,
    offset: Number(searchParams.get("offset")) || 0,
  })
  return NextResponse.json(result)
}, { requireAll: ["crm:read"] })

export const POST = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const body: CrmTaskInput = await req.json()
  if (!body.title) return NextResponse.json({ error: "title is required" }, { status: 400 })
  const task = await createTask(organizationId, userId, body)
  return NextResponse.json(task, { status: 201 })
}, { requireAll: ["crm:write"] })

export async function PATCH(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  const auth = withAuth(async (req: NextRequest, { organizationId }) => {
    const body: CrmTaskUpdateInput = await req.json()
    const task = await updateTask(organizationId, id, body)
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })
    return NextResponse.json(task)
  }, { requireAll: ["crm:write"] })
  return auth(req)
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  const auth = withAuth(async (_req: NextRequest, { organizationId }) => {
    const deleted = await deleteTask(organizationId, id)
    if (!deleted) return NextResponse.json({ error: "Task not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  }, { requireAll: ["crm:write"] })
  return auth(req)
}
