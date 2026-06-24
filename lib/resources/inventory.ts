import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"

export interface InventoryItem {
  id: string; organization_id: string; sku: string; name: string
  category: string; quantity: number; reorder_point: number
  eoq: number | null; unit_cost: number | null; location: string | null
  supplier: string | null; lead_time_days: number | null
  created_at: string; updated_at: string
}

export async function listInventory(organizationId: string): Promise<InventoryItem[]> {
  const db = createServiceClient()
  const { data } = await db.from("inventory_items").select("*").eq("organization_id", organizationId).order("name")
  return (data ?? []) as InventoryItem[]
}

export async function updateStock(organizationId: string, itemId: string, delta: number): Promise<InventoryItem | null> {
  const db = createServiceClient()
  const { data: item } = await db.from("inventory_items").select("*").eq("id", itemId).eq("organization_id", organizationId).single()
  if (!item) return null
  const newQty = (item as InventoryItem).quantity + delta
  const { data, error } = await db.from("inventory_items").update({ quantity: Math.max(0, newQty) }).eq("id", itemId).select("*").single()
  if (!error && newQty <= (item as InventoryItem).reorder_point) {
    await publish({
      type: "resources.low_stock", organization_id: organizationId,
      data: { item_id: itemId, current_qty: newQty, reorder_point: (item as InventoryItem).reorder_point },
    })
  }
  return data as InventoryItem ?? null
}
