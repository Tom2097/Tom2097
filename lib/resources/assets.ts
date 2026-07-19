import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"

export interface AssetNode {
  id: string; organization_id: string; parent_id: string | null
  name: string; category: string; subcategory: string | null; depth?: number
  serial_number: string | null; asset_tag: string | null
  status: "active" | "maintenance" | "retired" | "idle"
  location: string | null; purchase_date: string | null; purchase_value: number | null
  current_value: number | null; warranty_expiry: string | null
  metadata: Record<string, unknown>
  created_at: string; updated_at: string
}

export interface CreateAssetInput {
  name: string
  category: string | null
  subcategory: string | null
  parent_id: string | null
  serial_number: string | null
  asset_tag: string | null
  status: AssetNode["status"]
  location: string | null
  purchase_date: string | null
  purchase_value: number | null
  current_value: number | null
  warranty_expiry: string | null
  metadata: Record<string, unknown>
}

export async function listAssets(organizationId: string, category?: string): Promise<AssetNode[]> {
  const db = createServiceClient()
  let q = db.from("assets").select("*").eq("organization_id", organizationId).order("name")
  if (category) q = q.eq("category", category)
  const { data } = await q
  return (data ?? []) as AssetNode[]
}

export async function createAsset(organizationId: string, input: CreateAssetInput, userId: string): Promise<AssetNode | null> {
  const db = createServiceClient()

  if (input.parent_id) {
    const { data: parent } = await db
      .from("assets")
      .select("id")
      .eq("id", input.parent_id)
      .eq("organization_id", organizationId)
      .maybeSingle()
    if (!parent) return null
  }

  // Explicitly enumerate writable fields. organization_id, created_by, id,
  // and timestamps are always server-owned and cannot be overridden by JSON.
  const { data, error } = await db.from("assets").insert({
    organization_id: organizationId,
    created_by: userId,
    name: input.name,
    category: input.category,
    subcategory: input.subcategory,
    parent_id: input.parent_id,
    serial_number: input.serial_number,
    asset_tag: input.asset_tag,
    status: input.status,
    location: input.location,
    purchase_date: input.purchase_date,
    purchase_value: input.purchase_value,
    current_value: input.current_value,
    warranty_expiry: input.warranty_expiry,
    metadata: input.metadata,
  }).select("*").single()
  if (error) return null
  const asset = data as AssetNode
  await publish({ type: "resources.asset_created", organization_id: organizationId, data: { asset_id: asset.id, category: asset.category } })
  return asset
}

export async function getAssetTree(organizationId: string): Promise<AssetNode[]> {
  const assets = await listAssets(organizationId)
  const map = new Map(assets.map((a) => [a.id, { ...a, children: [] as AssetNode[] }]))
  const roots: AssetNode[] = []
  for (const a of map.values()) {
    if (a.parent_id && map.has(a.parent_id)) map.get(a.parent_id)!.children.push(a)
    else roots.push(a)
  }
  return roots
}
