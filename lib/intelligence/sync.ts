import { createServiceClient } from "@/lib/supabase/service"
import { upsertEntity, relateEntities } from "./operational-graph"
import type { OperationalEntity } from "./types"

export async function syncAllModules(organizationId: string): Promise<number> {
  let total = 0
  total += await syncCertificates(organizationId)
  total += await syncInstruments(organizationId)
  total += await syncAssets(organizationId)
  total += await syncBatches(organizationId)
  total += await syncDeals(organizationId)
  total += await syncInventory(organizationId)
  total += await syncDocuments(organizationId)
  await syncRelationships(organizationId)
  return total
}

async function syncCertificates(organizationId: string): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from("certificates")
    .select("id, name, status, type, expires_at, organization_id")
    .eq("organization_id", organizationId)
    .limit(100)

  if (!data) return 0
  for (const cert of data as Array<Record<string, unknown>>) {
    await upsertEntity({
      id: cert.id as string,
      organizationId: organizationId,
      type: "certificate",
      name: cert.name as string,
      status: (cert.status as string) || "active",
      module: "compliance",
      properties: { type: cert.type, expiresAt: cert.expires_at },
    })
  }
  return data.length
}

async function syncInstruments(organizationId: string): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from("instruments")
    .select("id, name, status, certificate_id, organization_id")
    .eq("organization_id", organizationId)
    .limit(100)

  if (!data) return 0
  for (const inst of data as Array<Record<string, unknown>>) {
    await upsertEntity({
      id: inst.id as string,
      organizationId: organizationId,
      type: "instrument",
      name: inst.name as string,
      status: (inst.status as string) || "active",
      module: "compliance",
      properties: { certificateId: inst.certificate_id },
    })
  }
  return data.length
}

async function syncAssets(organizationId: string): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from("assets")
    .select("id, name, status, next_maintenance, organization_id")
    .eq("organization_id", organizationId)
    .limit(100)

  if (!data) return 0
  for (const asset of data as Array<Record<string, unknown>>) {
    await upsertEntity({
      id: asset.id as string,
      organizationId: organizationId,
      type: "asset",
      name: asset.name as string,
      status: (asset.status as string) || "active",
      module: "resources",
      properties: { nextMaintenance: asset.next_maintenance },
    })
  }
  return data.length
}

async function syncBatches(organizationId: string): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from("production_batches")
    .select("id, name, status, throughput, asset_id, organization_id")
    .eq("organization_id", organizationId)
    .limit(100)

  if (!data) return 0
  for (const batch of data as Array<Record<string, unknown>>) {
    await upsertEntity({
      id: batch.id as string,
      organizationId: organizationId,
      type: "batch",
      name: batch.name as string,
      status: (batch.status as string) || "active",
      module: "operations",
      properties: { throughput: batch.throughput, assetId: batch.asset_id },
    })
  }
  return data.length
}

async function syncDeals(organizationId: string): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from("deals")
    .select("id, name, status, value, stage, organization_id")
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .limit(100)

  if (!data) return 0
  for (const deal of data as Array<Record<string, unknown>>) {
    await upsertEntity({
      id: deal.id as string,
      organizationId: organizationId,
      type: "deal",
      name: deal.name as string,
      status: (deal.status as string) || "active",
      module: "crm",
      properties: { value: deal.value, stage: deal.stage },
    })
  }
  return data.length
}

async function syncInventory(organizationId: string): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from("inventory_items")
    .select("id, name, quantity, reorder_point, organization_id")
    .eq("organization_id", organizationId)
    .limit(100)

  if (!data) return 0
  for (const item of data as Array<Record<string, unknown>>) {
    await upsertEntity({
      id: item.id as string,
      organizationId: organizationId,
      type: "resource",
      name: item.name as string,
      status: "active",
      module: "resources",
      properties: { quantity: item.quantity, reorderPoint: item.reorder_point },
    })
  }
  return data.length
}

async function syncDocuments(organizationId: string): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from("documents")
    .select("id, name, type, organization_id")
    .eq("organization_id", organizationId)
    .limit(100)

  if (!data) return 0
  for (const doc of data as Array<Record<string, unknown>>) {
    await upsertEntity({
      id: doc.id as string,
      organizationId: organizationId,
      type: "document",
      name: doc.name as string,
      status: "active",
      module: "operations",
      properties: { type: doc.type },
    })
  }
  return data.length
}

async function syncRelationships(organizationId: string): Promise<void> {
  const db = createServiceClient()

  const { data: instruments } = await db
    .from("instruments")
    .select("id, certificate_id, organization_id")
    .eq("organization_id", organizationId)
    .not("certificate_id", "is", null)

  if (instruments) {
    for (const inst of instruments as Array<Record<string, unknown>>) {
      await relateEntities(organizationId, inst.certificate_id as string, inst.id as string, "requires_certification")
    }
  }

  const { data: batches } = await db
    .from("production_batches")
    .select("id, asset_id, organization_id")
    .eq("organization_id", organizationId)
    .not("asset_id", "is", null)

  if (batches) {
    for (const batch of batches as Array<Record<string, unknown>>) {
      await relateEntities(organizationId, batch.asset_id as string, batch.id as string, "produces_batch")
    }
  }
}
