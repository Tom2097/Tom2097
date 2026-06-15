import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getPipelineSummary } from "@/lib/crm/engine"

/**
 * GET /api/v1/crm/pipeline — deal pipeline summary for the caller's org:
 * per-stage counts/value, weighted open value, and won value. Requires crm:read.
 */
const get = withAuth(
  async (_req: NextRequest, { organizationId }) => {
    try {
      return NextResponse.json({ pipeline: await getPipelineSummary(organizationId) })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to compute pipeline"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:read"] },
)

export { get as GET }
