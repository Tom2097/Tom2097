import { NextResponse } from "next/server"
import {
  addNode,
  addEdge,
  findRelatedNodes,
  traverse,
  getNode
} from "@/lib/intelligence"
import { getAuthenticatedUser } from "@/lib/auth/server-auth"
import { hasWorkspaceAccess } from "@/lib/auth/rbac"

/**
 * This route used to export POST_EDGE and GET_TRAVERSE alongside POST/GET --
 * Next.js's App Router only ever wires up the standard HTTP-verb export
 * names, so those two never actually received traffic. Nothing in the
 * frontend calls this route today. Both actions are now dispatched from the
 * single real POST/GET export via a body/query discriminator, the same
 * `{ action: "..." }` pattern used by app/api/auth/passkeys/register/route.ts.
 */

/**
 * POST: add a node to the operational graph (default), or add an edge when
 * `action: "add-edge"` is present in the body.
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  if (body.action === "add-edge") {
    const { from, to, relationshipType, properties, workspaceId } = body
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

  const { workspaceId, entityId, entityType, properties } = body

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
 * GET: find nodes related to ?nodeId=... (default), or traverse the graph
 * from ?startNodeId=... when ?view=traverse is given.
 */
export async function GET(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  if (searchParams.get("view") === "traverse") {
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