import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { approveAction, executeAction } from "@/lib/intelligence/engine"
import { getPendingApprovals, autoAssignFindings } from "@/lib/intelligence/agents"

export async function GET(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const actions = await getPendingApprovals(ctx.organizationId)
  return NextResponse.json({ actions })
}

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Body required" }, { status: 400 })

  if (body.action === "auto-assign") {
    const actions = await autoAssignFindings(ctx.organizationId)
    return NextResponse.json({ actions, count: actions.length })
  }

  if (body.action === "approve" && body.actionId) {
    const ok = await approveAction(body.actionId, ctx.organizationId)
    if (!ok) return NextResponse.json({ error: "Action not found" }, { status: 404 })
    return NextResponse.json({ status: "approved" })
  }

  if (body.action === "execute" && body.actionId) {
    const ok = await executeAction(body.actionId, ctx.organizationId)
    return NextResponse.json({ status: ok ? "executed" : "failed" })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
