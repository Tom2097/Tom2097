import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { dispatchEvent } from "@/lib/integrations/engine"

/**
 * POST /api/v1/integrations/dispatch
 * Body: { event_type: string, payload?: object }
 * Fan out an event to every active integration subscribed to it.
 * Requires integrations:write.
 */
const dispatch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: { event_type?: string; payload?: Record<string, unknown> }
    try {
      body = (await req.json()) as { event_type?: string; payload?: Record<string, unknown> }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const eventType = body.event_type
    if (!eventType || typeof eventType !== "string" || !eventType.trim()) {
      return NextResponse.json({ error: "event_type is required" }, { status: 400 })
    }

    try {
      const result = await dispatchEvent(organizationId, eventType.trim(), body.payload ?? {})
      await logAuthEvent({
        action: result.failed > 0 ? "integration.delivery_failed" : "integration.dispatched",
        userId,
        organizationId,
        resourceType: "integration",
        metadata: { ...result },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ result })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to dispatch event"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["integrations:write"] },
)

export { dispatch as POST }
