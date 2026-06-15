import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { getDsar, updateDsar } from "@/lib/legal/engine"
import type { DsarUpdateInput } from "@/lib/legal/types"

/** Extract id from /api/v1/legal/dsar/:id. */
function idFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("dsar")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET — fetch one. Requires legal:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const request = await getDsar(organizationId, id)
      if (!request) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ request })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch DSAR request"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["legal:read"] },
)

/** PATCH — update status / assignment / notes. Requires legal:write. */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    let body: DsarUpdateInput
    try {
      body = (await req.json()) as DsarUpdateInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    try {
      const result = await updateDsar(organizationId, id, body)
      if (!result) return NextResponse.json({ error: "not found" }, { status: 404 })
      const action =
        result.statusChange === "completed"
          ? "legal.dsar_completed"
          : result.statusChange === "rejected"
            ? "legal.dsar_rejected"
            : "legal.dsar_updated"
      await logAuthEvent({
        action,
        userId,
        organizationId,
        resourceType: "dsar_request",
        resourceId: id,
        metadata: { fields: Object.keys(body ?? {}), status: result.request.status },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ request: result.request })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update DSAR request"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["legal:write"] },
)

export { get as GET, patch as PATCH }
