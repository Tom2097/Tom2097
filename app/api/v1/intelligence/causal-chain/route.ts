import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * GET /api/v1/intelligence/causal-chain
 *
 * Backs the "Causal Chains" tab (components/digit/causal-chain-view.tsx) and
 * the cross-module graph (components/digit/causal-graph-visualization.tsx).
 * Built on `intelligence_entities` / `intelligence_relations`
 * (supabase/migrations/20260628_intelligence_brain.sql) -- the org-scoped
 * entity graph whose `type` check constraint (certificate/instrument/asset/
 * batch/deal/document/compliance_gap/resource) and `module` column line up
 * exactly with what the frontend renders. This is deliberately NOT the
 * workspace-scoped `causal_graph_nodes/edges` tables used by
 * /api/v1/intelligence/causal, which model raw causal *events*, not named
 * business entities with a module/type/status.
 *
 * ?entityId=<id>     -> a single chain containing that entity
 * ?crossModule=true  -> every connected component that spans more than one module
 */

interface EntityRow {
  id: string
  name: string
  type: string
  status: string
  module: string
}

interface ChainNode {
  entity: { id: string; name: string; type: string; status: string; module: string }
  module: string
  order: number
  monetaryImpact?: number
}

interface CausalLink {
  fromEntity: string
  fromModule: string
  toEntity: string
  toModule: string
  relationship: string
  monetaryImpact?: number
}

interface ChainResult {
  nodes: ChainNode[]
  links: CausalLink[]
  totalMonetaryRisk: number
  primaryCause: ChainNode | null
  affectedDeals: ChainNode[]
}

const MAX_DEPTH = 5

function buildChain(
  rootId: string,
  entitiesById: Map<string, EntityRow>,
  outgoing: Map<string, { to: string; relationship: string }[]>,
  incoming: Map<string, { from: string; relationship: string }[]>,
  riskByEntity: Map<string, number>,
): ChainResult | null {
  if (!entitiesById.has(rootId)) return null

  // BFS over the undirected graph to gather the connected component, tracking
  // depth from the root as a stable display "order".
  const depth = new Map<string, number>([[rootId, 0]])
  const queue = [rootId]
  while (queue.length > 0) {
    const current = queue.shift()!
    const currentDepth = depth.get(current)!
    if (currentDepth >= MAX_DEPTH) continue
    const neighbors = [
      ...(outgoing.get(current) ?? []).map((e) => e.to),
      ...(incoming.get(current) ?? []).map((e) => e.from),
    ]
    for (const next of neighbors) {
      if (!depth.has(next) && entitiesById.has(next)) {
        depth.set(next, currentDepth + 1)
        queue.push(next)
      }
    }
  }

  const nodeIds = Array.from(depth.keys())
  const nodes: ChainNode[] = nodeIds.map((id) => {
    const entity = entitiesById.get(id)!
    return {
      entity: { id: entity.id, name: entity.name, type: entity.type, status: entity.status, module: entity.module },
      module: entity.module,
      order: depth.get(id)!,
      monetaryImpact: riskByEntity.get(id) ?? 0,
    }
  })

  const nodeIdSet = new Set(nodeIds)
  const seenLinks = new Set<string>()
  const links: CausalLink[] = []
  for (const id of nodeIds) {
    for (const edge of outgoing.get(id) ?? []) {
      if (!nodeIdSet.has(edge.to)) continue
      const key = `${id}->${edge.to}:${edge.relationship}`
      if (seenLinks.has(key)) continue
      seenLinks.add(key)
      const fromEntity = entitiesById.get(id)!
      const toEntity = entitiesById.get(edge.to)!
      links.push({
        fromEntity: fromEntity.name,
        fromModule: fromEntity.module,
        toEntity: toEntity.name,
        toModule: toEntity.module,
        relationship: edge.relationship,
        monetaryImpact: riskByEntity.get(edge.to) ?? 0,
      })
    }
  }

  const totalMonetaryRisk = nodes.reduce((sum, n) => sum + (n.monetaryImpact ?? 0), 0)
  const hasIncoming = new Set(links.map((l) => l.toEntity))
  const primaryCause =
    nodes.find((n) => n.order === 0) ??
    nodes.find((n) => !hasIncoming.has(n.entity.name)) ??
    nodes[0] ??
    null
  const affectedDeals = nodes.filter((n) => n.entity.type === "deal")

  return { nodes, links, totalMonetaryRisk, primaryCause, affectedDeals }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const entityId = searchParams.get("entityId")
    const crossModule = searchParams.get("crossModule") === "true"

    if (!entityId && !crossModule) {
      return NextResponse.json({ error: "entityId or crossModule=true is required" }, { status: 400 })
    }

    const db = createServiceClient()
    const [{ data: entities }, { data: relations }, { data: findings }] = await Promise.all([
      db
        .from("intelligence_entities")
        .select("id, name, type, status, module")
        .eq("organization_id", organizationId),
      db
        .from("intelligence_relations")
        .select("from_entity_id, to_entity_id, relationship")
        .eq("organization_id", organizationId),
      db
        .from("intelligence_findings")
        .select("entity_id, monetary_risk")
        .eq("organization_id", organizationId)
        .not("entity_id", "is", null),
    ])

    const entitiesById = new Map((entities ?? []).map((e) => [e.id as string, e as EntityRow]))
    const outgoing = new Map<string, { to: string; relationship: string }[]>()
    const incoming = new Map<string, { from: string; relationship: string }[]>()
    for (const rel of relations ?? []) {
      const from = rel.from_entity_id as string
      const to = rel.to_entity_id as string
      if (!entitiesById.has(from) || !entitiesById.has(to)) continue
      if (!outgoing.has(from)) outgoing.set(from, [])
      outgoing.get(from)!.push({ to, relationship: rel.relationship as string })
      if (!incoming.has(to)) incoming.set(to, [])
      incoming.get(to)!.push({ from, relationship: rel.relationship as string })
    }

    const riskByEntity = new Map<string, number>()
    for (const f of findings ?? []) {
      const entityId = f.entity_id as string | null
      if (!entityId) continue
      riskByEntity.set(entityId, (riskByEntity.get(entityId) ?? 0) + ((f.monetary_risk as number) ?? 0))
    }

    if (entityId) {
      if (!entitiesById.has(entityId)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      const chain = buildChain(entityId, entitiesById, outgoing, incoming, riskByEntity)
      return NextResponse.json(chain)
    }

    // crossModule=true: every connected component spanning more than one module.
    const visited = new Set<string>()
    const chains: ChainResult[] = []
    for (const id of entitiesById.keys()) {
      if (visited.has(id)) continue
      const chain = buildChain(id, entitiesById, outgoing, incoming, riskByEntity)
      if (!chain) continue
      for (const node of chain.nodes) visited.add(node.entity.id)
      const moduleCount = new Set(chain.nodes.map((n) => n.module)).size
      if (moduleCount > 1) chains.push(chain)
    }
    chains.sort((a, b) => b.totalMonetaryRisk - a.totalMonetaryRisk)

    return NextResponse.json({ chains })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
