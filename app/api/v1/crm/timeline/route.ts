import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { addTimelineEntry, listTimeline } from "@/lib/crm/extensions"
import type { TimelineEntryInput } from "@/lib/crm/types"

export const GET = withAuth(async (req: NextRequest, { organizationId }) => {
  const { searchParams } = new URL(req.url)
  const result = await listTimeline(organizationId, {
    entityType: searchParams.get("entityType") as any,
    entityId: searchParams.get("entityId") ?? undefined,
    entryType: searchParams.get("entryType") as any,
    limit: Number(searchParams.get("limit")) || 50,
    offset: Number(searchParams.get("offset")) || 0,
  })
  return NextResponse.json(result)
}, { requireAll: ["crm:read"] })

export const POST = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const body: TimelineEntryInput = await req.json()
  if (!body.entity_type || !body.entity_id || !body.title) {
    return NextResponse.json({ error: "entity_type, entity_id, and title are required" }, { status: 400 })
  }
  const entry = await addTimelineEntry(organizationId, userId, body)
  return NextResponse.json(entry, { status: 201 })
}, { requireAll: ["crm:write"] })
