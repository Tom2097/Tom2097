import { NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context.server"
import { emitCrossWorkspaceEvent, listWorkspaceEvents, getCorrelationChain, createCorrelationId } from "@/lib/events/cross-workspace"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const { type, sourceWorkspace, targetWorkspaces, payload, correlationId } = await request.json()
    if (!type || !sourceWorkspace || !targetWorkspaces) {
      return NextResponse.json({ error: "type, sourceWorkspace, and targetWorkspaces are required" }, { status: 400 })
    }

    const emitted = await emitCrossWorkspaceEvent({
      type, source_workspace: sourceWorkspace,
      target_workspaces: targetWorkspaces,
      organization_id: orgId, payload: payload ?? {},
      correlation_id: correlationId ?? createCorrelationId(),
    })

    return NextResponse.json({ success: emitted })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to emit event"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const url = new URL(request.url)
    const workspace = url.searchParams.get("workspace") ?? undefined
    const correlationId = url.searchParams.get("correlation_id")

    if (correlationId) {
      const chain = await getCorrelationChain(correlationId, orgId)
      return NextResponse.json({ success: true, data: chain ?? null })
    }

    const events = await listWorkspaceEvents(orgId, workspace)
    return NextResponse.json({ success: true, data: events })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch events"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
