import { createServiceClient } from "@/lib/supabase/service"
import type { IntelligenceFinding, GraphRelation } from "./types"
import { getEntityGraph, traverseGraph } from "./operational-graph"

const ENTITY_MODULE_MAP: Record<string, string> = {
  certificate: "compliance",
  instrument: "compliance",
  asset: "resources",
  batch: "operations",
  deal: "crm",
  document: "operations",
  compliance_gap: "compliance",
  resource: "resources",
}

const ENTITY_TYPE_ORDER = [
  "document",
  "compliance_gap",
  "certificate",
  "instrument",
  "asset",
  "batch",
  "resource",
  "deal",
]

interface OperationalEntity {
  id: string
  type: string
  name: string
  status: string
  module: string
  properties: Record<string, unknown>
}

export type ChainNode = {
  entity: OperationalEntity
  module: string
  order: number
  monetaryImpact?: number
}

interface CausalLink {
  source: string
  target: string
  type: string
  confidence: number
  monetaryImpact?: number
}

export type CausalChainResult = {
  nodes: ChainNode[]
  links: CausalLink[]
  totalMonetaryRisk: number
  primaryCause: ChainNode | null
  affectedDeals: ChainNode[]
}

export async function traceCausalChain(
  organizationId: string,
  startEntityId: string,
): Promise<CausalChainResult> {
  const entities = await traverseGraph(organizationId, startEntityId, 4)
  const entityMap = new Map<string, OperationalEntity>()
  for (const e of entities) entityMap.set(e.id, e)

  const sorted = entities.sort((a, b) => {
    return ENTITY_TYPE_ORDER.indexOf(a.type) - ENTITY_TYPE_ORDER.indexOf(b.type)
  })

  const nodes: ChainNode[] = sorted.map((entity, i) => ({
    entity,
    module: ENTITY_MODULE_MAP[entity.type] ?? "unknown",
    order: i,
    monetaryImpact: estimateEntityImpact(entity),
  }))

  const links: CausalLink[] = []
  for (const entity of sorted) {
      const graph = await getEntityGraph(organizationId, entity.id)
    if (!graph) continue

    for (const rel of graph.relations as GraphRelation[]) {
      const targetEntity = entityMap.get(rel.targetId)
      if (!targetEntity) continue
        links.push({
          source: entity.name,
          target: targetEntity.name,
          type: rel.relationship,
          confidence: 0.8,
          monetaryImpact: estimateEntityImpact(targetEntity),
        })
    }
  }

  const totalMonetaryRisk = nodes.reduce((sum, n) => sum + (n.monetaryImpact ?? 0), 0)
  const primaryCause = nodes.length > 0 ? nodes[0] : null
  const affectedDeals = nodes.filter((n) => n.entity.type === "deal")

  return { nodes, links, totalMonetaryRisk, primaryCause, affectedDeals }
}

export async function traceFromFinding(
  finding: IntelligenceFinding,
): Promise<CausalChainResult | null> {
  if (!finding.entityId) return null
  return traceCausalChain(finding.organizationId!, finding.entityId)
}

function estimateEntityImpact(entity: OperationalEntity): number {
  const baseValues: Record<string, number> = {
    certificate: 50000,
    instrument: 30000,
    asset: 75000,
    batch: 15000,
    deal: 100000,
    document: 5000,
    compliance_gap: 25000,
    resource: 10000,
  }
  return baseValues[entity.type] ?? 5000
}

function estimateRelationshipImpact(
  from: OperationalEntity,
  to: OperationalEntity,
): number {
  const fromValue = estimateEntityImpact(from)
  const toValue = estimateEntityImpact(to)
  return Math.round((fromValue + toValue) * 0.3)
}

export async function getCrossModuleChains(
  organizationId: string,
): Promise<CausalChainResult[]> {
  const db = createServiceClient()
  const { data: dealEntities } = await db
    .from("intelligence_entities")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("type", "deal")
    .limit(20)

  if (!dealEntities || dealEntities.length === 0) return []

  const results: CausalChainResult[] = []
  for (const deal of dealEntities as Array<{ id: string }>) {
    try {
      const chain = await traceCausalChain(organizationId, deal.id)
      results.push(chain)
    } catch {
      // We can skip individual failures instead of console.logging
    }
  }

  return results.sort((a, b) => b.totalMonetaryRisk - a.totalMonetaryRisk)
}
