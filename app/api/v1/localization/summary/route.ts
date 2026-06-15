import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getSummary } from "@/lib/localization/engine"

/**
 * GET /api/v1/localization/summary — per-locale translation completeness.
 * Requires localization:read.
 */
const get = withAuth(
  async (_req: NextRequest, { organizationId }) => {
    try {
      return NextResponse.json(await getSummary(organizationId))
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to build summary"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["localization:read"] },
)

export { get as GET }
