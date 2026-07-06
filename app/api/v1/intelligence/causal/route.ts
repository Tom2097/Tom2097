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
 * POST: Add an event to the causal graph
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { workspaceId, entityId, entityType, eventType, metadata } = await request.json()

  if (!workspaceId || !(await hasWorkspaceAccess(user.id, workspaceId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const event = await addEvent(workspaceId, entityId, entityType, eventType, metadata)
    return NextResponse.json(event)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add event" },
      { status: 400 }
    )
  }
}

/**
 * POST: Add a causal link
 */
export async function POST_LINK(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { from, to, relationshipType, confidence, metadata } = await request.json()

  try {
    const fromEvent = await getEvent(from)
    const toEvent = await getEvent(to)

    if (!fromEvent || !toEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    if (!(await hasWorkspaceAccess(user.id, fromEvent.workspaceId)) || 
        !(await hasWorkspaceAccess(user.id, toEvent.workspaceId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const link = await addCausalLink(from, to, relationshipType, confidence, metadata)
    return NextResponse.json(link)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add causal link" },
      { status: 400 }
    )
  }
}

/**
 * GET: Find root causes
 */
export async function GET_ROOTS(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("eventId")
  const maxDepth = parseInt(searchParams.get("maxDepth") || "3")

  if (!eventId) {
    return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
  }

  try {
    const event = await getEvent(eventId)
    if (!event || !(await hasWorkspaceAccess(user.id, event.workspaceId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const rootCauses = await findRootCauses(eventId, maxDepth)
    return NextResponse.json(rootCauses)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to find root causes" },
      { status: 400 }
    )
  }
}

/**
 * GET: Find downstream effects
 */
export async function GET_EFFECTS(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("eventId")
  const maxDepth = parseInt(searchParams.get("maxDepth") || "3")

  if (!eventId) {
    return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
  }

  try {
    const event = await getEvent(eventId)
    if (!event || !(await hasWorkspaceAccess(user.id, event.workspaceId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const downstreamEffects = await findDownstreamEffects(eventId, maxDepth)
    return NextResponse.json(downstreamEffects)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to find downstream effects" },
      { status: 400 }
    )
  }
}

/**
 * Helper: Get event by ID
 */
async function getEvent(eventId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("causal_graph_nodes")
    .select("*")
    .eq("event_id", eventId)
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