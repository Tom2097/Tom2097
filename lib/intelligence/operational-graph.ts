import { createServiceClient } from "@/lib/supabase/service"
import type { OperationalEntity, GraphRelation, EntityGraphResult } from "./types"

const ENTITIES_TABLE = "intelligence_entities"
const RELATIONS_TABLE = "intelligence_relations"

export async function upsertEntity(
  entity: Omit<OperationalEntity, "lastUpdated" | "relatedEntities">,
): Promise<void> {
  const db = createServiceClient()
  await db.from(ENTITIES_TABLE).upsert(
    {
      id: entity.id,
      organization_id: entity.organizationId,
      type: entity.type,
      name: entity.name,
      status: entity.status,
      module: entity.module,
      properties: entity.properties,
      last_updated: new Date().toISOString(),
    },
    { onConflict: "id" },
  )
}

export async function relateEntities(
  organizationId: string,
  fromId: string,
  toId: string,
  relationship: string,
): Promise<void> {
  const db = createServiceClient()
  await db.from(RELATIONS_TABLE).insert({
    organization_id: organizationId,
    from_entity_id: fromId,
    to_entity_id: toId,
    relationship,
  })
}

export async function getEntityGraph(
  organizationId: string,
  entityId: string,
  depth: number = 2,
): Promise<EntityGraphResult | null> {
  const db = createServiceClient()
  const { data: entity } = await db
    .from(ENTITIES_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", entityId)
    .single()

  if (!entity) return null

  const { data: outbound } = await db
    .from(RELATIONS_TABLE)
    .select("to_entity_id, relationship")
    .eq("organization_id", organizationId)
    .eq("from_entity_id", entityId)

  const { data: inbound } = await db
    .from(RELATIONS_TABLE)
    .select("from_entity_id, relationship")
    .eq("organization_id", organizationId)
    .eq("to_entity_id", entityId)

  const relations: GraphRelation[] = [
    ...(outbound || []).map((r: { to_entity_id: string; relationship: string }) => ({
      targetId: r.to_entity_id,
      targetType: "",
      relationship: r.relationship,
      direction: "outbound" as const,
    })),
    ...(inbound || []).map((r: { from_entity_id: string; relationship: string }) => ({
      targetId: r.from_entity_id,
      targetType: "",
      relationship: r.relationship,
      direction: "inbound" as const,
    })),
  ]

  return {
    entity: {
      id: entity.id,
      organizationId: entity.organization_id,
      type: entity.type,
      name: entity.name,
      status: entity.status,
      module: entity.module,
      properties: entity.properties as Record<string, unknown>,
      relatedEntities: relations,
      lastUpdated: new Date(entity.last_updated),
    },
    relations,
  }
}

export async function traverseGraph(
  organizationId: string,
  startEntityId: string,
  maxDepth: number = 3,
): Promise<OperationalEntity[]> {
  const visited = new Set<string>()
  const queue: Array<{ id: string; depth: number }> = [{ id: startEntityId, depth: 0 }]
  const result: OperationalEntity[] = []

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (visited.has(id) || depth > maxDepth) continue
    visited.add(id)

    const graph = await getEntityGraph(organizationId, id)
    if (!graph) continue

    result.push(graph.entity)

    for (const rel of graph.relations) {
      const nextId = rel.direction === "outbound" ? rel.targetId : rel.targetId
      if (!visited.has(nextId)) {
        queue.push({ id: nextId, depth: depth + 1 })
      }
    }
  }

  return result
}

export async function findPath(
  organizationId: string,
  fromId: string,
  toId: string,
): Promise<OperationalEntity[] | null> {
  const db = createServiceClient()
  const { data: path } = await db.rpc("find_entity_path", {
    p_organization_id: organizationId,
    p_from_id: fromId,
    p_to_id: toId,
  })

  if (!path || !Array.isArray(path)) return null

  const entities: OperationalEntity[] = []
  for (const row of path as Array<Record<string, unknown>>) {
    const { data: entity } = await db
      .from(ENTITIES_TABLE)
      .select("*")
      .eq("id", row.entity_id)
      .single()
    if (entity) {
      entities.push({
        id: entity.id,
        organizationId: entity.organization_id,
        type: entity.type,
        name: entity.name,
        status: entity.status,
        module: entity.module,
        properties: entity.properties as Record<string, unknown>,
        relatedEntities: [],
        lastUpdated: new Date(entity.last_updated),
      })
    }
  }
  return entities.length > 0 ? entities : null
}

export async function getEntitiesByModule(
  organizationId: string,
  module: string,
): Promise<OperationalEntity[]> {
  const db = createServiceClient()
  const { data: entities } = await db
    .from(ENTITIES_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("module", module)

  return (entities || []).map((e: Record<string, unknown>) => ({
    id: e.id as string,
    organizationId: e.organization_id as string,
    type: e.type as OperationalEntity["type"],
    name: e.name as string,
    status: e.status as string,
    module: e.module as string,
    properties: e.properties as Record<string, unknown>,
    relatedEntities: [],
    lastUpdated: new Date(e.last_updated as string),
  }))
}
