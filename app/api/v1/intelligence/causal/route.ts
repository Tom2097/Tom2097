import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  addEvent,
  addCausalLink,
  findRootCauses,
  findDownstreamEffects
} from "@/lib/intelligence"
import { getAuthenticatedUser } from "@/lib/auth/server-auth"
import { hasWorkspaceAccess } from "@/lib/auth/rbac"

/**
 * Next.js route handlers only recognize GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS
 * -- this file used to export POST_LINK/GET_ROOTS/GET_EFFECTS, which Next.js
 * silently never wires up. Restructured into one real POST (branching on an
 * `action` field: "event" to add a causal-graph event, "link" to add a causal
 * link between two events) and one real GET (branching on a `type` query
 * param: "roots" or "effects").
 */

export async function POST(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const action = body.action ?? "event"

  if (action === "link") {
    return addLink(user.id, body)
  }

  return addEventHandler(user.id, body)
}

async function addEventHandler(
  userId: string,
  body: { workspaceId?: string; entityId?: string; entityType?: string; eventType?: string; metadata?: Record<string, unknown> }
) {
  const { workspaceId, entityId, entityType, eventType, metadata } = body

  if (!workspaceId || !(await hasWorkspaceAccess(userId, workspaceId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const event = await addEvent(workspaceId, entityId ?? "", entityType ?? "", eventType ?? "", metadata ?? {})
    return NextResponse.json(event)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add event" },
      { status: 400 }
    )
  }
}

async function addLink(
  userId: string,
  body: { from?: string; to?: string; relationshipType?: string; confidence?: number; metadata?: Record<string, unknown> }
) {
  const { from, to, relationshipType, confidence, metadata } = body

  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 })
  }

  try {
    const fromEvent = await getEvent(from)
    const toEvent = await getEvent(to)

    if (!fromEvent || !toEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    if (!(await hasWorkspaceAccess(userId, fromEvent.workspaceId)) ||
        !(await hasWorkspaceAccess(userId, toEvent.workspaceId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const link = await addCausalLink(from, to, relationshipType ?? "causes", confidence ?? 0, metadata ?? {})
    return NextResponse.json(link)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add causal link" },
      { status: 400 }
    )
  }
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const eventId = searchParams.get("eventId")
  const maxDepth = parseInt(searchParams.get("maxDepth") || "3")

  if (!eventId) {
    return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
  }
  if (type !== "roots" && type !== "effects") {
    return NextResponse.json({ error: "type must be 'roots' or 'effects'" }, { status: 400 })
  }

  try {
    const event = await getEvent(eventId)
    if (!event || !(await hasWorkspaceAccess(user.id, event.workspaceId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = type === "roots"
      ? await findRootCauses(eventId, maxDepth)
      : await findDownstreamEffects(eventId, maxDepth)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : `Failed to find ${type}` },
      { status: 400 }
    )
  }
}

/**
 * Helper: Get event by ID.
 */
async function getEvent(eventId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("causal_graph_nodes")
    .select("*")
    .eq("id", eventId)
    .single()

  if (error) return null

  return {
    id: data.id,
    workspaceId: data.workspace_id,
    entityId: data.entity_id,
    entityType: data.entity_type,
    eventType: data.event_type,
    timestamp: data.created_at,
    metadata: data.metadata,
  }
}
