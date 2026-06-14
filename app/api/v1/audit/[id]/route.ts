import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { getAuditLogEntry } from "@/lib/audit/store"

/**
 * GET /api/v1/audit/[id]
 * Fetch a single audit log entry by ID (org-scoped).
 * Requires audit:read.
 * ID is extracted from the URL path since withAuth wraps to (req) => Response.
 */
function makeHandler(id: string) {
  return async function handler(_req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
    try {
      const entry = await getAuditLogEntry(ctx.organizationId, id)

      if (!entry) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }

      return NextResponse.json(entry)
    } catch (err) {
      console.log("[v0] audit entry fetch error:", err)
      return NextResponse.json({ error: "Failed to fetch audit log entry" }, { status: 500 })
    }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  return withAuth(makeHandler(id), { requireAll: ["audit:read"] })(req)
}
