import { NextResponse } from "next/server"
import {
  createAgent,
  executeAction,
  listAgents,
  getAgent,
  getAuditTrail
} from "@/lib/intelligence"
import { getAuthenticatedUser, getOrganizationId } from "@/lib/auth/server-auth"
import { hasWorkspaceAccess } from "@/lib/auth/rbac"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * This route used to export POST_ACTION and GET_AUDIT alongside POST/GET --
 * Next.js's App Router only ever wires up the standard HTTP-verb export
 * names (GET, POST, PUT, DELETE, ...), so those two extra exports were never
 * actually routed to and 404'd if anyone tried to call them. Nothing in the
 * frontend calls this base /agents route today (only /agents/status and
 * /agents/run, separate route files), so this is a correctness fix with no
 * behavior change for real traffic. Both actions are now dispatched from the
 * single real POST/GET export via a body/query discriminator, the same
 * `{ action: "..." }` pattern used by app/api/auth/passkeys/register/route.ts.
 */

/**
 * POST: create a new agent (default), or execute an agent action when
 * `action: "execute"` is present in the body.
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  if (body.action === "execute") {
    const { agentId, targetAction, targetEntityId, targetEntityType, parameters } = body
    try {
      const agent = await getAgent(agentId)
      if (!agent || !(await hasWorkspaceAccess(user.id, agent.workspaceId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const result = await executeAction(agentId, targetAction, targetEntityId, targetEntityType, parameters)
      return NextResponse.json(result)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to execute action" },
        { status: 400 }
      )
    }
  }

  const { name, description, permissions, workspaceId } = body

  if (!workspaceId || !(await hasWorkspaceAccess(user.id, workspaceId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const agent = await createAgent(name, description, permissions, workspaceId)
    return NextResponse.json(agent)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create agent" },
      { status: 400 }
    )
  }
}

/**
 * GET: list agents in a workspace (?workspaceId=...), list every agent
 * across all of the caller's workspaces (no `workspaceId`), or fetch an
 * agent's audit trail when ?view=audit&agentId=... is given.
 */
export async function GET(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  if (searchParams.get("view") === "audit") {
    const agentId = searchParams.get("agentId")
    if (!agentId) {
      return NextResponse.json({ error: "Agent ID is required" }, { status: 400 })
    }

    try {
      const agent = await getAgent(agentId)
      if (!agent || !(await hasWorkspaceAccess(user.id, agent.workspaceId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const auditTrail = await getAuditTrail(agentId)
      return NextResponse.json(auditTrail)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to get audit trail" },
        { status: 400 }
      )
    }
  }

  const workspaceId = searchParams.get("workspaceId")

  if (workspaceId) {
    if (!(await hasWorkspaceAccess(user.id, workspaceId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    try {
      const agents = await listAgents(workspaceId)
      return NextResponse.json(agents)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to list agents" },
        { status: 400 }
      )
    }
  }

  // No explicit workspaceId -- resolve every workspace under the caller's
  // organization and aggregate their agents. `agents` is workspace_id-scoped
  // (not organization_id-scoped), the same tenant-scoping gap documented in
  // app/api/v1/intelligence/actions/route.ts for the sibling agent_actions
  // table, so we mirror that route's approach here.
  try {
    const organizationId = await getOrganizationId(user.id)
    const db = createServiceClient()
    const { data: workspaces } = await db.from("workspaces").select("id").eq("organization_id", organizationId)
    const workspaceIds = (workspaces ?? []).map((w) => w.id as string)

    if (workspaceIds.length === 0) {
      return NextResponse.json([])
    }

    const { data, error } = await db.from("agents").select("*").in("workspace_id", workspaceIds)
    if (error) throw error

    const agents = (data ?? []).map((agent: Record<string, unknown>) => ({
      id: agent.id as string,
      name: agent.name as string,
      description: agent.description as string,
      permissions: agent.permissions as string[],
      workspaceId: agent.workspace_id as string,
      isActive: agent.is_active as boolean,
      createdAt: agent.created_at as string,
      updatedAt: agent.updated_at as string,
    }))

    return NextResponse.json(agents)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list agents" },
      { status: 400 }
    )
  }
}