import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { listActivities, logActivity, validateActivity } from "@/lib/crm/engine"
import type { ActivityInput, ActivityType, CrmEntityType, ListActivitiesOptions } from "@/lib/crm/types"

/**
 * GET /api/v1/crm/activities — list activities, typically filtered to an entity.
 * Query: ?entityType=company|contact|deal&entityId=&type=&limit=&offset=
 * Requires crm:read.
 */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const opts: ListActivitiesOptions = {
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 100),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      entityType: (sp.get("entityType") as CrmEntityType | null) ?? undefined,
      entityId: sp.get("entityId") ?? undefined,
      type: (sp.get("type") as ActivityType | null) ?? undefined,
    }
    try {
      return NextResponse.json(await listActivities(organizationId, opts))
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list activities"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:read"] },
)

/**
 * POST /api/v1/crm/activities — log an activity against a CRM entity.
 * Requires crm:write.
 */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const invalid = validateActivity(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    try {
      const activity = await logActivity(organizationId, userId, body as unknown as ActivityInput)
      if (!activity) return NextResponse.json({ error: "target entity not found" }, { status: 404 })
      await logAuthEvent({
        action: "crm.activity_logged",
        userId,
        organizationId,
        resourceType: "crm_activity",
        resourceId: activity.id,
        metadata: { type: activity.type, entity_type: activity.entity_type, entity_id: activity.entity_id },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ activity }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to log activity"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:write"] },
)

export { list as GET, create as POST }
