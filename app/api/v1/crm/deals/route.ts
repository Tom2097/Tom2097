import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getClientIp, logAuthEvent } from "@/lib/auth/audit"
import { createDeal, listDeals, validateDeal } from "@/lib/crm/engine"
import type { DealInput, DealStage, ListDealsOptions } from "@/lib/crm/types"

/** GET /api/v1/crm/deals — list. Requires crm:read. */
const list = withAuth(
  async (req: NextRequest, { organizationId }) => {
    const sp = req.nextUrl.searchParams
    const opts: ListDealsOptions = {
      limit: Math.min(Math.max(Number(sp.get("limit") ?? 50), 1), 100),
      offset: Math.max(Number(sp.get("offset") ?? 0), 0),
      stage: (sp.get("stage") as DealStage | null) ?? undefined,
      companyId: sp.get("companyId") ?? undefined,
      contactId: sp.get("contactId") ?? undefined,
    }
    try {
      return NextResponse.json(await listDeals(organizationId, opts))
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to list deals"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:read"] },
)

/** POST /api/v1/crm/deals — create. Requires crm:write. */
const create = withAuth(
  async (req: NextRequest, { organizationId, userId }) => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const invalid = validateDeal(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    try {
      const deal = await createDeal(organizationId, userId, body as unknown as DealInput)
      await logAuthEvent({
        action: "crm.deal_created",
        userId,
        organizationId,
        resourceType: "crm_deal",
        resourceId: deal.id,
        metadata: { title: deal.title, stage: deal.stage, value: deal.value },
        ipAddress: getClientIp(req.headers),
      })
      return NextResponse.json({ deal }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed to create deal"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  },
  { requireAll: ["crm:write"] },
)

export { list as GET, create as POST }
