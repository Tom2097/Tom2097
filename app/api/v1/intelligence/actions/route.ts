import { NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * `agent_actions` (see supabase/migrations/20260731000000_intelligence_remaining.sql)
 * has no organization_id column -- it's scoped by workspace_id, like
 * operational_graph_nodes in the same migration. So tenant scoping here goes
 * through the caller's workspaces, the same pattern used in
 * app/api/v1/intelligence/aggregate/route.ts.
 *
 * The intelligence command center's "Auto-Assign" and per-action "Approve"
 * buttons both POST here with a `{ action: "auto-assign" | "approve", ... }`
 * command body -- neither ever supplies agent_id, action, or
 * target_entity_id/type, so falling through to a raw insert (agent_id is
 * NOT NULL) crashed with a 500 on every click. Handle both as real commands
 * before the generic create path.
 */

interface AgentActionRow {
  id: string
  agent_id: string
  action: string
  target_entity_id: string | null
  target_entity_type: string | null
  parameters: Record<string, unknown> | null
  status: string
}

// The command center's AgentAction interface (agentId/type/targetEntity/
// targetModule) never matched these raw DB column names -- previously the
// route just returned rows as-is, so every field it rendered was undefined.
function toAction(row: AgentActionRow) {
  const targetModule = typeof row.parameters?.module === "string" ? row.parameters.module : row.target_entity_type
  return {
    id: row.id,
    agentId: row.agent_id,
    type: row.action,
    targetEntity: row.target_entity_id,
    targetModule,
    status: row.status,
    config: row.parameters ?? {},
  }
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const db = createServiceClient()

    const { data: workspaces } = await db.from("workspaces").select("id").eq("organization_id", organizationId)
    const workspaceIds = (workspaces ?? []).map((w) => w.id)

    if (workspaceIds.length === 0) {
      return NextResponse.json({ actions: [] })
    }

    const { data, error } = await db
      .from("agent_actions")
      .select("*")
      .in("workspace_id", workspaceIds)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) throw error
    return NextResponse.json({ actions: (data || []).map(toAction) })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const db = createServiceClient()

    const { data: workspaces } = await db.from("workspaces").select("id").eq("organization_id", organizationId)
    const workspaceIds = new Set((workspaces ?? []).map((w) => w.id))
    const workspaceIdList = Array.from(workspaceIds)

    const body = await request.json()

    if (body.action === "approve") {
      const actionId = typeof body.actionId === "string" ? body.actionId : undefined
      if (!actionId) return NextResponse.json({ error: "actionId is required" }, { status: 400 })

      const { data, error } = await db
        .from("agent_actions")
        .update({ status: "approved" })
        .eq("id", actionId)
        .in("workspace_id", workspaceIdList)
        .select()
        .maybeSingle()

      if (error) throw error
      if (!data) return NextResponse.json({ error: "Action not found" }, { status: 404 })
      return NextResponse.json(data)
    }

    if (body.action === "auto-assign") {
      if (workspaceIdList.length === 0) {
        return NextResponse.json({ assigned: 0, skipped: 0, reason: "No workspace found for this organization" })
      }

      const [{ data: findings }, { data: agents }, { data: existingActions }] = await Promise.all([
        db.from("intelligence_findings").select("id, source_module").eq("organization_id", organizationId).eq("status", "active"),
        db.from("agents").select("id, permissions, workspace_id").eq("is_active", true).in("workspace_id", workspaceIdList),
        db.from("agent_actions").select("target_entity_id").in("workspace_id", workspaceIdList).eq("target_entity_type", "finding"),
      ])

      const alreadyAssigned = new Set((existingActions ?? []).map((a) => a.target_entity_id))
      const unassigned = (findings ?? []).filter((f) => !alreadyAssigned.has(f.id))

      let assigned = 0
      for (const finding of unassigned) {
        const agent = (agents ?? []).find((a) => (a.permissions ?? []).includes(finding.source_module))
        if (!agent) continue
        const { error } = await db.from("agent_actions").insert({
          agent_id: agent.id,
          action: `review_${finding.source_module ?? "finding"}`,
          target_entity_id: finding.id,
          target_entity_type: "finding",
          parameters: { module: finding.source_module },
          status: "pending",
          workspace_id: agent.workspace_id,
          created_at: new Date().toISOString(),
        })
        if (!error) assigned++
      }

      return NextResponse.json({
        assigned,
        skipped: unassigned.length - assigned,
        reason: (agents ?? []).length === 0 ? "No active agents configured" : undefined,
      })
    }

    // ---- Generic create path (a real agent-driven action, not a UI command) ----
    const { id, agent_id, action, target_entity_id, target_entity_type, parameters } = body
    if (!agent_id || !action) {
      return NextResponse.json({ error: "agent_id and action are required" }, { status: 400 })
    }

    const requestedWorkspaceId = typeof body.workspace_id === "string" ? body.workspace_id : undefined
    const workspaceId = requestedWorkspaceId && workspaceIds.has(requestedWorkspaceId)
      ? requestedWorkspaceId
      : workspaces?.[0]?.id

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found for this organization" }, { status: 400 })
    }

    const { data, error } = await db
      .from("agent_actions")
      .insert({
        id: id || crypto.randomUUID(),
        agent_id,
        action,
        target_entity_id,
        target_entity_type,
        parameters: parameters ?? {},
        status: body.status || "pending",
        workspace_id: workspaceId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
