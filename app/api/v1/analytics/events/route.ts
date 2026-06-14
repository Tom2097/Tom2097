import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { trackEvents, validateEvent } from "@/lib/analytics/engine"
import type { EventInput } from "@/lib/analytics/types"

/**
 * POST /api/v1/analytics/events
 * Ingest one event (object) or many (array / { events: [] }). Org-scoped via
 * withAuth; the authenticated user is recorded as the default actor.
 */
const ingest = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const list: unknown[] = Array.isArray(body)
      ? body
      : body && typeof body === "object" && Array.isArray((body as { events?: unknown[] }).events)
        ? (body as { events: unknown[] }).events
        : [body]

    if (list.length === 0) {
      return NextResponse.json({ error: "no events provided" }, { status: 400 })
    }

    for (const e of list) {
      const invalid = validateEvent(e)
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
    }

    try {
      const { inserted } = await trackEvents(organizationId, userId, list as EventInput[])
      return NextResponse.json({ inserted }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to record events"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["analytics:write"] },
)

export { ingest as POST }
