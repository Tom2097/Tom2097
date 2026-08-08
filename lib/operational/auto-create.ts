import { extractFields, extractLineItems, INVOICE_SCHEMA } from "@/lib/extraction/engine"
import { createServiceClient } from "@/lib/supabase/service"
import { createCapa } from "@/lib/compliance/capa"
import { listInventory, updateStock, type InventoryItem } from "@/lib/resources/inventory"

/**
 * Matches an extracted invoice/PO line item to a known inventory item.
 * Only returns a match when it's unambiguous (a unique SKU or exact
 * case-insensitive name match) -- anything fuzzier is left unmatched so we
 * never guess and silently adjust the wrong item's stock.
 */
function matchInventoryItem(
  lineItem: { description: string; sku?: string },
  items: InventoryItem[],
): InventoryItem | null {
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  if (lineItem.sku) {
    const sku = lineItem.sku.trim().toLowerCase()
    if (sku) {
      const skuMatches = items.filter((i) => i.sku && i.sku.trim().toLowerCase() === sku)
      if (skuMatches.length === 1) return skuMatches[0]
    }
  }

  const desc = lineItem.description.trim().toLowerCase()
  if (desc) {
    const exactNameMatches = items.filter((i) => i.name.trim().toLowerCase() === desc)
    if (exactNameMatches.length === 1) return exactNameMatches[0]
  }

  // A SKU embedded as a token inside the free-text description, e.g.
  // "Widget A (SKU-123) x4".
  const skuTokenMatches = items.filter(
    (i) => i.sku && new RegExp(`\\b${escapeRegExp(i.sku.trim())}\\b`, "i").test(lineItem.description)
  )
  if (skuTokenMatches.length === 1) return skuTokenMatches[0]

  return null
}

export async function autoCreateTasks(
  organizationId: string, documentId: string, content: string, classification: string,
  userId: string,
): Promise<string[]> {
  const taskIds: string[] = []
  const db = createServiceClient()

  if (classification === "legal" || classification === "complaint" || classification === "deviation") {
    const capa = await createCapa(organizationId, {
      title: `Auto-created from document ${documentId}`,
      description: content.slice(0, 1000), source: "auto_classify",
      severity: "major",
    }, userId)
    if (capa) {
      taskIds.push(capa.id)
      await db.from("document_tasks").insert({
        document_id: documentId, organization_id: organizationId,
        task_type: "capa", task_id: capa.id, auto_created: true,
        status: "pending",
      })
    }
  }

  if (classification === "finance") {
    const invoice = await extractFields(content.slice(0, 10000), INVOICE_SCHEMA).catch(() => [])
    if (invoice.length > 0) {
      const amount = invoice.find((f) => f.name === "total_amount")?.value ?? "0"
      const vendor = invoice.find((f) => f.name === "vendor_name")?.value ?? "Unknown"
      await db.from("accounts_payable").insert({
        organization_id: organizationId, document_id: documentId,
        vendor, amount: parseFloat(amount) || 0, status: "pending_review",
        source_id: documentId,
      }).maybeSingle()
      taskIds.push("payable_created")

      // This document produced an accounts_payable row -- i.e. it's a bill
      // for goods/services the org received from a vendor -- so any line
      // item we can confidently tie to an existing inventory item should
      // increase that item's on-hand stock. Line items we can't cleanly
      // match are left alone rather than guessed.
      const lineItems = await extractLineItems(content.slice(0, 10000)).catch(() => [])
      if (lineItems.length > 0) {
        const inventoryItems = await listInventory(organizationId)
        for (const lineItem of lineItems) {
          if (!(lineItem.quantity > 0)) continue
          const match = matchInventoryItem(lineItem, inventoryItems)
          if (match) {
            await updateStock(organizationId, match.id, lineItem.quantity)
          }
        }
      }
    }
  }

  return taskIds
}

export async function getDocumentFeed(organizationId: string, limit = 50): Promise<Array<{
  id: string; name: string; type: string; classification: string | null
  status: string; task_count: number; created_at: string
  content: string | null; extracted_entities: Record<string, unknown> | null
}>> {
  const db = createServiceClient()
  const { data } = await db.from("documents")
    .select("id, name, type, classification, status, created_at, content, extracted_entities")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  const docs = data ?? []
  if (docs.length === 0) return []

  const { data: taskRows } = await db
    .from("document_tasks")
    .select("document_id")
    .in("document_id", docs.map((d) => d.id))

  const taskCounts = new Map<string, number>()
  for (const row of taskRows ?? []) {
    const id = row.document_id as string
    taskCounts.set(id, (taskCounts.get(id) ?? 0) + 1)
  }

  interface AutoCreateItem {
    id: string
    name: string
    type: string
    classification: string | null
    status: string
    created_at: string
    content: string | null
    extracted_entities: Record<string, unknown> | null
    task_count: number
  }

  return docs.map((d) => ({
    ...d,
    task_count: taskCounts.get(d.id as string) ?? 0,
  })) as AutoCreateItem[]
}
