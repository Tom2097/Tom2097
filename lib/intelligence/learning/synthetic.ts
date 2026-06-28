/**
 * Synthetic data generator — creates plausible training data from the
 * database schema so the learning system has observations to work with
 * during development and onboarding.
 *
 * Run once or on a schedule to seed the online models. Generates data
 * that follows realistic patterns (trends, seasonality, noise).
 */

import { createServiceClient } from "@/lib/supabase/service"
import { observe } from "./predictor"
import { upsertEntity, relateEntities } from "../operational-graph"

export async function seedSyntheticData(organizationId: string): Promise<{ metrics: number; entities: number }> {
  let metricCount = 0
  let entityCount = 0

  metricCount += await seedPipelineMetrics(organizationId)
  metricCount += await seedComplianceMetrics(organizationId)
  metricCount += await seedResourceMetrics(organizationId)
  metricCount += await seedOperationalMetrics(organizationId)
  entityCount += await seedEntityRelationships(organizationId)

  return { metrics: metricCount, entities: entityCount }
}

async function seedPipelineMetrics(organizationId: string): Promise<number> {
  let count = 0
  const now = Date.now()

  for (let day = 90; day >= 0; day--) {
    const base = 50000 + Math.sin(day * 0.1) * 20000
    const trend = day * 200
    const noise = (Math.random() - 0.5) * 15000
    const value = Math.round(Math.max(10000, base + trend + noise))
    const ts = new Date(now - day * 86400000)

    await observe(organizationId, "pipeline_value", value, ts)
    count++
  }

  for (let day = 90; day >= 0; day--) {
    const deals = Math.round(5 + Math.sin(day * 0.15) * 3 + Math.random() * 4)
    const ts = new Date(now - day * 86400000)
    await observe(organizationId, "deals_created", deals, ts)
    count++
  }

  return count
}

async function seedComplianceMetrics(organizationId: string): Promise<number> {
  let count = 0
  const now = Date.now()

  for (let day = 180; day >= 0; day -= 7) {
    const certs = Math.round(8 + Math.sin(day * 0.05) * 3 + Math.random() * 2)
    const ts = new Date(now - day * 86400000)
    await observe(organizationId, "active_certifications", certs, ts)
    count++
  }

  for (let day = 90; day >= 0; day--) {
    const score = Math.round(Math.max(60, 85 - Math.random() * 15 + day * 0.05))
    const ts = new Date(now - day * 86400000)
    await observe(organizationId, "compliance_score", score, ts)
    count++
  }

  return count
}

async function seedResourceMetrics(organizationId: string): Promise<number> {
  let count = 0
  const now = Date.now()

  for (let day = 60; day >= 0; day--) {
    const utilization = Math.round(50 + Math.sin(day * 0.2) * 20 + Math.random() * 15)
    const ts = new Date(now - day * 86400000)
    await observe(organizationId, "resource_utilization", utilization, ts)
    count++
  }

  for (let day = 30; day >= 0; day -= 3) {
    const stockoutRisk = Math.round(Math.random() * 30 + day * 0.5)
    const ts = new Date(now - day * 86400000)
    await observe(organizationId, "stockout_risk", stockoutRisk, ts)
    count++
  }

  return count
}

async function seedOperationalMetrics(organizationId: string): Promise<number> {
  let count = 0
  const now = Date.now()

  for (let day = 60; day >= 0; day -= 2) {
    const throughput = Math.round(500 + Math.sin(day * 0.1) * 100 + Math.random() * 80)
    const ts = new Date(now - day * 86400000)
    await observe(organizationId, "production_throughput", throughput, ts)
    count++
  }

  for (let day = 30; day >= 0; day--) {
    const efficiency = Math.round(70 + Math.sin(day * 0.15) * 10 + Math.random() * 10)
    const ts = new Date(now - day * 86400000)
    await observe(organizationId, "operational_efficiency", efficiency, ts)
    count++
  }

  return count
}

async function seedEntityRelationships(organizationId: string): Promise<number> {
  let count = 0
  const db = createServiceClient()

  const entities = [
    { id: "syn-cert-001", name: "ISO 9001:2025", type: "certificate" as const, module: "compliance" },
    { id: "syn-cert-002", name: "FDA GMP-2026", type: "certificate" as const, module: "compliance" },
    { id: "syn-cert-003", name: "CE Marking-2025", type: "certificate" as const, module: "compliance" },
    { id: "syn-inst-001", name: "Mass Spectrometer A7", type: "instrument" as const, module: "compliance" },
    { id: "syn-inst-002", name: "HPLC System XR", type: "instrument" as const, module: "compliance" },
    { id: "syn-asset-001", name: "Production Line 1", type: "asset" as const, module: "resources" },
    { id: "syn-asset-002", name: "Packaging Unit 3", type: "asset" as const, module: "resources" },
    { id: "syn-batch-001", name: "Batch A-2026-001", type: "batch" as const, module: "operations" },
    { id: "syn-batch-002", name: "Batch A-2026-002", type: "batch" as const, module: "operations" },
    { id: "syn-deal-001", name: "PharmaCorp Framework", type: "deal" as const, module: "crm" },
    { id: "syn-deal-002", name: "BioGen Q3 Supply", type: "deal" as const, module: "crm" },
  ]

  for (const ent of entities) {
    const { data } = await db
      .from("intelligence_entities")
      .select("id")
      .eq("id", ent.id)
      .maybeSingle()
    if (!data) {
      await upsertEntity({ ...ent, organizationId, status: "active", properties: { synthetic: true } })
      count++
    }
  }

  const { data: existingRelations } = await db
    .from("intelligence_relations")
    .select("from_entity_id")
    .eq("organization_id", organizationId)
    .limit(1)

  if (!existingRelations || existingRelations.length === 0) {
    const relationships = [
      { from: "syn-cert-001", to: "syn-inst-001", rel: "certifies" },
      { from: "syn-cert-002", to: "syn-inst-002", rel: "certifies" },
      { from: "syn-inst-001", to: "syn-asset-001", rel: "calibrates" },
      { from: "syn-inst-002", to: "syn-asset-002", rel: "calibrates" },
      { from: "syn-asset-001", to: "syn-batch-001", rel: "produces" },
      { from: "syn-asset-001", to: "syn-batch-002", rel: "produces" },
      { from: "syn-batch-001", to: "syn-deal-001", rel: "fulfills" },
      { from: "syn-batch-002", to: "syn-deal-002", rel: "fulfills" },
    ]
    for (const rel of relationships) {
      await relateEntities(organizationId, rel.from, rel.to, rel.rel)
      count++
    }
  }

  return count
}
