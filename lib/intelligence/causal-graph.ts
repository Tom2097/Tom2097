import { createClient } from "../../lib/supabase/server"

interface CausalNode {
  id: string
  workspaceId: string
  entityId: string
  entityType: string
  eventType: string
  timestamp: string
  metadata: Record<string, unknown>
}

interface CausalEdge {
  id: string
  from: string
  to: string
  relationshipType: string
  confidence: number
  metadata: Record<string, unknown>
  createdAt: string
}

/**
 * Adds a node to the causal graph.
 */
export async function addNode(
  workspaceId: string,
  entityId: string,
  entityType: string,
  eventType: string,
  metadata: Record<string, unknown>
): Promise<CausalNode> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("causal_graph_nodes")
    .insert([{
      workspace_id: workspaceId,
      entity_id: entityId,
      entity_type: entityType,
      event_type: eventType,
      metadata
    }])
    .select()
    .single()

  if (error) throw new Error(`Failed to add node: ${error.message}`)

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

/**
 * Adds an edge to the causal graph.
 */
export async function addEdge(
  from: string,
  to: string,
  relationshipType: string,
  confidence: number,
  metadata: Record<string, unknown>
): Promise<CausalEdge> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("causal_graph_edges")
    .insert([{
      from,
      to,
      relationship_type: relationshipType,
      confidence,
      metadata
    }])
    .select()
    .single()

  if (error) throw new Error(`Failed to add edge: ${error.message}`)

  return {
    id: data.id,
    from: data.from,
    to: data.to,
    relationshipType: data.relationship_type,
    confidence: data.confidence,
    metadata: data.metadata,
    createdAt: data.created_at,
  }
}

/**
 * Finds root causes for a node.
 */
export async function findRootCauses(nodeId: string): Promise<CausalNode[]> {
  const supabase = await createClient()
  const rootCauses: CausalNode[] = []
  const visited = new Set<string>()
  const queue: string[] = [nodeId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    const { data: edges, error: edgeError } = await supabase
      .from("causal_graph_edges")
      .select("*")
      .eq("to", currentId)

    if (edgeError) throw new Error(`Failed to fetch edges: ${edgeError.message}`)

    if (edges.length === 0) {
      const { data: node, error: nodeError } = await supabase
        .from("causal_graph_nodes")
        .select("*")
        .eq("id", currentId)
        .single()

      if (nodeError) throw new Error(`Failed to fetch node: ${nodeError.message}`)
      rootCauses.push({
        id: node.id,
        workspaceId: node.workspace_id,
        entityId: node.entity_id,
        entityType: node.entity_type,
        eventType: node.event_type,
        timestamp: node.created_at,
        metadata: node.metadata,
      })
    } else {
      for (const edge of edges) {
        queue.push(edge.from)
      }
    }
  }

  return rootCauses
}

/**
 * Finds downstream effects for a node.
 */
export async function findDownstreamEffects(nodeId: string): Promise<CausalNode[]> {
  const supabase = await createClient()
  const downstreamEffects: CausalNode[] = []
  const visited = new Set<string>()
  const queue: string[] = [nodeId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    const { data: edges, error: edgeError } = await supabase
      .from("causal_graph_edges")
      .select("*")
      .eq("from", currentId)

    if (edgeError) throw new Error(`Failed to fetch edges: ${edgeError.message}`)

    for (const edge of edges) {
      const { data: node, error: nodeError } = await supabase
        .from("causal_graph_nodes")
        .select("*")
        .eq("id", edge.to)
        .single()

      if (nodeError) throw new Error(`Failed to fetch node: ${nodeError.message}`)
      downstreamEffects.push({
        id: node.id,
        workspaceId: node.workspace_id,
        entityId: node.entity_id,
        entityType: node.entity_type,
        eventType: node.event_type,
        timestamp: node.created_at,
        metadata: node.metadata,
      })
      queue.push(edge.to)
    }
  }

  return downstreamEffects
}