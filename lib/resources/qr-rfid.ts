import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"

export interface AssetTag {
  id: string
  asset_id: string
  organization_id: string
  tag_type: "qr" | "rfid"
  tag_value: string
  encoded_data: string
  created_at: string
}

export interface TagScan {
  id: string
  asset_id: string
  organization_id: string
  tag_type: "qr" | "rfid"
  scanned_at: string
  scanned_by: string | null
  location: string | null
  metadata: Record<string, unknown>
}

export function generateQrData(assetId: string, orgId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://digit.app"
  return `${baseUrl}/scan?asset=${assetId}&org=${orgId.slice(0, 8)}`
}

export function generateRfidValue(): string {
  const prefix = "E2"
  const random = Array.from({ length: 14 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("").toUpperCase()
  return `${prefix}${random}`
}

export async function createAssetTag(
  organizationId: string,
  assetId: string,
  tagType: "qr" | "rfid",
): Promise<AssetTag | null> {
  const db = createServiceClient()
  const tagValue = tagType === "qr"
    ? generateQrData(assetId, organizationId)
    : generateRfidValue()
  const encodedData = tagType === "qr"
    ? JSON.stringify({ assetId, orgId: organizationId, type: "asset" })
    : tagValue

  const { data, error } = await db.from("asset_tags").insert({
    organization_id: organizationId,
    asset_id: assetId,
    tag_type: tagType,
    tag_value: tagValue,
    encoded_data: encodedData,
  }).select("*").single()

  if (error) return null
  const tag = data as AssetTag

  await publish({
    type: "resources.asset_tagged",
    organization_id: organizationId,
    data: { asset_id: assetId, tag_type: tagType, tag_id: tag.id },
  })

  return tag
}

export async function recordTagScan(
  organizationId: string,
  tagValue: string,
  scannedBy: string | null,
  location: string | null,
): Promise<TagScan | null> {
  const db = createServiceClient()

  const { data: tag } = await db
    .from("asset_tags")
    .select("id, asset_id")
    .eq("tag_value", tagValue)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!tag) return null

  const { data, error } = await db.from("asset_scans").insert({
    organization_id: organizationId,
    asset_id: tag.asset_id,
    tag_type: tagValue.startsWith("E2") ? "rfid" : "qr",
    scanned_by: scannedBy,
    location,
    metadata: {},
  }).select("*").single()

  if (error) return null

  await publish({
    type: "resources.asset_scanned",
    organization_id: organizationId,
    data: { asset_id: tag.asset_id },
  })

  return data as TagScan
}

export async function getAssetTags(
  organizationId: string,
  assetId?: string,
): Promise<AssetTag[]> {
  const db = createServiceClient()
  let q = db.from("asset_tags").select("*").eq("organization_id", organizationId)
  if (assetId) q = q.eq("asset_id", assetId)
  const { data } = await q
  return (data ?? []) as AssetTag[]
}

export async function getAssetScanHistory(
  organizationId: string,
  assetId: string,
): Promise<TagScan[]> {
  const db = createServiceClient()
  const { data } = await db
    .from("asset_scans")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("asset_id", assetId)
    .order("scanned_at", { ascending: false })
  return (data ?? []) as TagScan[]
}

export async function bulkTagAssets(
  organizationId: string,
  assetIds: string[],
  tagType: "qr" | "rfid",
): Promise<AssetTag[]> {
  const results: AssetTag[] = []
  for (const assetId of assetIds) {
    const tag = await createAssetTag(organizationId, assetId, tagType)
    if (tag) results.push(tag)
  }
  return results
}
