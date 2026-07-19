import { NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * `agent_actions` (see supabase/migrations/20260731000000_intelligence_remaining.sql)
 * has no organization_id column -- it's scoped by workspace_id, like
 * operational_graph_nodes in the same migration. So tenant scoping here goes
 * through the caller's workspaces, the same pattern used in
 * app/api/v1/intelligence/aggregate/route.ts.
 */

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
    return NextResponse.json({ actions: data || [] })
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

    const body = await request.json()

    // Never trust a client-supplied workspace/org -- only a workspace that
    // actually belongs to the caller's own organization may be targeted.
    const requestedWorkspaceId = typeof body.workspace_id === "string" ? body.workspace_id : undefined
    const workspaceId = requestedWorkspaceId && workspaceIds.has(requestedWorkspaceId)
      ? requestedWorkspaceId
      : workspaces?.[0]?.id

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace found for this organization" }, { status: 400 })
    }

    const { id, agent_id, action, target_entity_id, target_entity_type, parameters } = body

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
