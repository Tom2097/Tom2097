import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { listDeliveries } from "@/lib/integrations/engine"
import type { DeliveryStatus, ListDeliveriesOptions } from "@/lib/integrations/types"

/** Extract the integration id from /api/v1/integrations/:id/deliveries. */
function integrationIdFromUrl(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  const idx = parts.indexOf("integrations")
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null
}

/**
 * GET /api/v1/integrations/:id/deliveries
 * Delivery history for an integration. Requires integrations:read.
 * Query: ?limit=&offset=&status=pending|success|failed
 */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const id = integrationIdFromUrl(req)
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
    const sp = req.nextUrl.searchParams
    const opts: ListDeliveriesOptions = {
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 100),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      status: (sp.get("status") as DeliveryStatus | null) ?? undefined,
    }
    try {
      const result = await listDeliveries(organizationId, id, opts)
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list deliveries"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["integrations:read"] },
)

export { list as GET }
