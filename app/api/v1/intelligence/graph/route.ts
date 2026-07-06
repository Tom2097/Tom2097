import { NextResponse } from "next/server"
import { addNode, addEdge, findRelatedNodes, traverse, getNode, getEdge } from "@/lib/intelligence/operational-graph"
import { getAuthenticatedUser } from "@/lib/auth/server-auth"
import { hasWorkspaceAccess } from "@/lib/auth/rbac"

/**
 * POST: Add a node to the operational graph
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { workspaceId, entityId, entityType, properties } = await request.json()

  if (!workspaceId || !(await hasWorkspaceAccess(user.id, workspaceId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const node = await addNode(workspaceId, entityId, entityType, properties)
    return NextResponse.json(node)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add node" },
      { status: 400 }
    )
  }
}

/**
 * POST: Add an edge to the operational graph
 */
export async function POST_EDGE(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { from, to, relationshipType, properties, workspaceId } = await request.json()

  if (!workspaceId || !(await hasWorkspaceAccess(user.id, workspaceId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const edge = await addEdge(from, to, relationshipType, properties, workspaceId)
    return NextResponse.json(edge)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add edge" },
      { status: 400 }
    )
  }
}

/**
 * GET: Find related nodes
 */
export async function GET(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const nodeId = searchParams.get("nodeId")
  const relationshipType = searchParams.get("relationshipType") || undefined
  const direction = searchParams.get("direction") as "incoming" | "outgoing" | "both" | undefined

  if (!nodeId) {
    return NextResponse.json({ error: "Node ID is required" }, { status: 400 })
  }

  try {
    const node = await getNode(nodeId)
    if (!node || !(await hasWorkspaceAccess(user.id, node.workspaceId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const relatedNodes = await findRelatedNodes(nodeId, relationshipType, direction)
    return NextResponse.json(relatedNodes)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to find related nodes" },
      { status: 400 }
    )
  }
}

/**
 * GET: Traverse the graph
 */
export async function GET_TRAVERSE(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const startNodeId = searchParams.get("startNodeId")
  const maxDepth = parseInt(searchParams.get("maxDepth") || "3")

  if (!startNodeId) {
    return NextResponse.json({ error: "Start node ID is required" }, { status: 400 })
  }

  try {
    const node = await getNode(startNodeId)
    if (!node || !(await hasWorkspaceAccess(user.id, node.workspaceId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await traverse(startNodeId, maxDepth)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to traverse graph" },
      { status: 400 }
    )
  }
}