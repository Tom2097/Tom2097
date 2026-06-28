import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { executeIntelligenceAction } from "@/lib/intelligence/executor"
import { approveAction } from "@/lib/intelligence/engine"
import { getPendingApprovals } from "@/lib/intelligence/agents"

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.actionId) {
    return NextResponse.json({ error: "actionId required" }, { status: 400 })
  }

  const approved = await approveAction(body.actionId, ctx.organizationId)
  if (!approved) return NextResponse.json({ error: "Action not found or already approved" }, { status: 404 })

  const actions = await getPendingApprovals(ctx.organizationId)
  const action = actions.find((a) => a.id === body.actionId)
  if (!action) return NextResponse.json({ error: "Action not in pending list" }, { status: 404 })

  const ok = await executeIntelligenceAction(action, ctx.organizationId)
  return NextResponse.json({ status: ok ? "executed" : "failed" })
}
