import { NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context.server"
import { runProvisionStep } from "@/lib/crm/auto-provision"

function extractDealId(dealUrl: string): string | null {
  const match = dealUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  return match ? match[0] : null
}

// Auto-provision on Won, triggered manually (the "Start" button in
// CrmAutoProvision). Steps also run automatically -- see lib/crm/jobs.ts's
// crm.auto_provision handler, invoked by the deal.won event when a deal's
// stage flips to "won" (app/api/v1/crm/deals/route.ts's PATCH handler).
// Both paths share the same real step logic in lib/crm/auto-provision.ts.
export async function POST(request: Request) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { stepId, dealUrl } = await request.json().catch(() => ({}))
  if (!stepId || !dealUrl) return NextResponse.json({ error: "stepId and dealUrl are required" }, { status: 400 })

  const dealId = extractDealId(dealUrl)
  if (!dealId) return NextResponse.json({ error: "Could not identify a deal from that URL/ID" }, { status: 400 })

  try {
    await runProvisionStep(ctx.organizationId, ctx.userId, dealId, stepId)
    return NextResponse.json({ success: true, stepId })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provisioning step failed"
    const status = message === "Deal not found" ? 404 : message.includes("no associated company") || message.startsWith("Unknown provision step") ? 400 : 500
    console.error("[ai/provision] step failed:", error)
    return NextResponse.json({ error: message }, { status })
  }
}
