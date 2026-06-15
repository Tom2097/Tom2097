import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getSystemHealth } from "@/lib/monitoring/engine"

/**
 * GET /api/v1/monitoring/health
 * Aggregate health snapshot for the caller's org (monitor status rollup +
 * open incident count). Requires monitoring:read.
 */
const health = withAuth(
  async (_req: NextRequest, { organizationId }) => {
    try {
      const snapshot = await getSystemHealth(organizationId)
      return NextResponse.json(snapshot)
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to compute health"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["monitoring:read"] },
)

export { health as GET }
