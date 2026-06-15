import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { deleteDeal, getDeal, updateDeal } from "@/lib/crm/engine"
import type { DealUpdateInput } from "@/lib/crm/types"

function idFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("deals")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/** GET — fetch one. Requires crm:read. */
const get = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const deal = await getDeal(organizationId, id)
      if (!deal) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ deal })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to fetch deal"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:read"] },
)

/** PATCH — edit (incl. stage transitions). Requires crm:write. */
const patch = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    let body: DealUpdateInput
    try {
      body = (await req.json()) as DealUpdateInput
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    try {
      const updated = await updateDeal(organizationId, id, body)
      if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "crm.deal_updated",
        userId,
        organizationId,
        resourceType: "crm_deal",
        resourceId: id,
        metadata: { fields: Object.keys(body ?? {}), stage: updated.stage },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ deal: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to update deal"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:write"] },
)

/** DELETE — remove. Requires crm:manage. */
const remove = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    const id = idFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    try {
      const ok = await deleteDeal(organizationId, id)
      if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 })
      await logAuthEvent({
        action: "crm.deal_deleted",
        userId,
        organizationId,
        resourceType: "crm_deal",
        resourceId: id,
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to delete deal"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:manage"] },
)

export { get as GET, patch as PATCH, remove as DELETE }
