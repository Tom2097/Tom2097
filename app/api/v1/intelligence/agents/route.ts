import { NextResponse } from "next/server"
import {
  createAgent,
  executeAction,
  listAgents,
  getAgent,
  getAuditTrail
} from "../../../../../lib/intelligence"
import { getAuthenticatedUser } from "@/lib/auth/server-auth"
import { hasWorkspaceAccess } from "../../../../../lib/auth/rbac"

/**
 * POST: Create a new agent
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, description, permissions, workspaceId } = await request.json()

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
 * GET: List agents in a workspace
 */
export async function GET(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
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

/**
 * POST: Execute an agent action
 */
export async function POST_ACTION(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { agentId, action, targetEntityId, targetEntityType, parameters } = await request.json()

  try {
    const agent = await getAgent(agentId)
    if (!agent || !(await hasWorkspaceAccess(user.id, agent.workspaceId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await executeAction(agentId, action, targetEntityId, targetEntityType, parameters)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute action" },
      { status: 400 }
    )
  }
}

/**
 * GET: Get agent audit trail
 */
export async function GET_AUDIT(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
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