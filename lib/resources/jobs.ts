import { registerJobHandler } from "@/lib/jobs/handlers"
import { broadcast } from "@/lib/notifications/engine"

/**
 * Runs when an inventory.low event's job subscription fires
 * (event_job_subscriptions: inventory.low -> resources.notify_reorder) --
 * i.e. automatically, whenever a real stock change (lib/resources/inventory.ts's
 * updateStock, the single choke point every quantity change goes through)
 * lands an item's quantity at or below its reorder point.
 */
registerJobHandler("resources.notify_reorder", async (organizationId, payload) => {
  const itemId = payload.item_id as string | undefined
  const name = payload.name as string | undefined
  const currentQty = payload.current_qty as number | undefined
  const reorderPoint = payload.reorder_point as number | undefined
  if (!itemId || currentQty == null || reorderPoint == null) {
    throw new Error("resources.notify_reorder job missing item_id, current_qty, or reorder_point")
  }

  const label = name ?? itemId
  const isOut = currentQty <= 0

  await broadcast(organizationId, {
    type: isOut ? "error" : "warning",
    category: "inventory_low_stock",
    priority: isOut ? "urgent" : "high",
    title: isOut ? `Out of stock: ${label}` : `Low stock: ${label}`,
    body: `${label} is at ${currentQty} unit${currentQty === 1 ? "" : "s"} (reorder point ${reorderPoint}).`,
    data: { item_id: itemId, name: label, current_qty: currentQty, reorder_point: reorderPoint },
    source: "system",
  })
})
