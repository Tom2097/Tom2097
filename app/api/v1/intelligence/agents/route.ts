import { NextResponse } from "next/server"
import {
  createAgent,
  executeAction,
  listAgents,
  getAgent,
  getAuditTrail
} from "@/lib/intelligence"
import { getAuthenticatedUser } from "@/lib/auth/server-auth"
import { hasWorkspaceAccess } from "@/lib/auth/rbac"

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
 * GET: list agents in a workspace (?workspaceId=...), or fetch an agent's
 * audit trail when ?view=audit&agentId=... is given.
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

  if (!workspaceId || !(await hasWorkspaceAccess(user.id, workspaceId))) {
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