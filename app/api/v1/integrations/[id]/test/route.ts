import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { testIntegration } from "@/lib/integrations/engine"

/** Extract the integration id from /api/v1/integrations/:id/test. */
function integrationIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("integrations")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/**
 * POST /api/v1/integrations/:id/test
 * Send a one-off test.event to the integration regardless of subscriptions.
 * Requires integrations:write.
 */
const test = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = integrationIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const result = await testIntegration(organizationId, id)
      if (!result) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "integration.tested",
        userId,
        organizationId,
        resourceType: "integration",
        resourceId: id,
        metadata: { ok: result.ok, status: result.status },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ result })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to test integration"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["integrations:write"] },
)

export { test as POST }
