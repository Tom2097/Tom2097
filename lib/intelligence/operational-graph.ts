import { createClient } from "../../lib/supabase/server"

interface OperationalNode {
  id: string
  workspaceId: string
  entityId: string
  entityType: string
  properties: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface OperationalEdge {
  id: string
  from: string
  to: string
  relationshipType: string
  properties: Record<string, unknown>
  workspaceId: string
  createdAt: string
}

/**
 * Adds a node to the operational graph.
 */
export async function addNode(
  workspaceId: string,
  entityId: string,
  entityType: string,
  properties: Record<string, unknown>
): Promise<OperationalNode> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("operational_graph_nodes")
    .insert([{
      workspace_id: workspaceId,
      entity_id: entityId,
      entity_type: entityType,
      properties
    }])
    .select()
    .single()

  if (error) throw new Error(`Failed to add node: ${error.message}`)

  return {
    id: data.id,
    workspaceId: data.workspace_id,
    entityId: data.entity_id,
    entityType: data.entity_type,
    properties: data.properties,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

/**
 * Updates a node in the operational graph.
 */
export async function updateNode(
  nodeId: string,
  properties: Record<string, unknown>
): Promise<OperationalNode | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("operational_graph_nodes")
    .update({ properties, updated_at: new Date().toISOString() })
    .eq("id", nodeId)
    .select()
    .single()

  if (error) return null

  return {
    id: data.id,
    workspaceId: data.workspace_id,
    entityId: data.entity_id,
    entityType: data.entity_type,
    properties: data.properties,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

/**
 * Adds an edge to the operational graph.
 */
export async function addEdge(
  from: string,
  to: string,
  relationshipType: string,
  properties: Record<string, unknown>,
  workspaceId: string
): Promise<OperationalEdge> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("operational_graph_edges")
    .insert([{
      from,
      to,
      relationship_type: relationshipType,
      properties,
      workspace_id: workspaceId
    }])
    .select()
    .single()

  if (error) throw new Error(`Failed to add edge: ${error.message}`)

  return {
    id: data.id,
    from: data.from,
    to: data.to,
    relationshipType: data.relationship_type,
    properties: data.properties,
    workspaceId: data.workspace_id,
    createdAt: data.created_at,
  }
}

/**
 * Finds nodes related to a given node.
 */
export async function findRelatedNodes(
  nodeId: string,
  relationshipType?: string,
  direction: "incoming" | "outgoing" | "both" = "both"
): Promise<OperationalNode[]> {
  const supabase = await createClient()

  let query = supabase
    .from("operational_graph_edges")
    .select("from, to")

  if (direction === "incoming") {
    query = query.eq("to", nodeId)
  } else if (direction === "outgoing") {
    query = query.eq("from", nodeId)
  } else {
    query = query.or(`and(from.eq.${nodeId},to.eq.${nodeId})`)
  }

  if (relationshipType) {
    query = query.eq("relationship_type", relationshipType)
  }

  const { data: edges, error: edgeError } = await query
  if (edgeError) throw new Error(`Failed to find related nodes: ${edgeError.message}`)

  const relatedIds = edges.map(edge => (edge.from === nodeId ? edge.to : edge.from))
  const { data: nodes, error: nodeError } = await supabase
    .from("operational_graph_nodes")
    .select("*")
    .in("id", relatedIds)

  if (nodeError) throw new Error(`Failed to fetch nodes: ${nodeError.message}`)

  return nodes.map(node => ({
    id: node.id,
    workspaceId: node.workspace_id,
    entityId: node.entity_id,
    entityType: node.entity_type,
    properties: node.properties,
    createdAt: node.created_at,
    updatedAt: node.updated_at,
  }))
}

/**
 * Traverses the graph from a starting node (mock implementation).
 */
export async function traverse(
  startNodeId: string,
  maxDepth: number = 3
): Promise<{ nodes: OperationalNode[]; edges: OperationalEdge[] }> {
  const supabase = await createClient()
  const { data: startNode, error: nodeError } = await supabase
    .from("operational_graph_nodes")
    .select("*")
    .eq("id", startNodeId)
    .single()

  if (nodeError) throw new Error(`Failed to fetch start node: ${nodeError.message}`)

  return {
    nodes: [{
      id: startNode.id,
      workspaceId: startNode.workspace_id,
      entityId: startNode.entity_id,
      entityType: startNode.entity_type,
      properties: startNode.properties,
      createdAt: startNode.created_at,
      updatedAt: startNode.updated_at,
    }],
    edges: []
  }
}