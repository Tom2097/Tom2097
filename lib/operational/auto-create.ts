import { extractFields, INVOICE_SCHEMA } from "@/lib/extraction/engine"
import { createServiceClient } from "@/lib/supabase/service"
import { createCapa } from "@/lib/compliance/capa"
import { publish } from "@/lib/events/bus"

export async function autoCreateTasks(
  organizationId: string, documentId: string, content: string, classification: string,
  userId: string,
): Promise<string[]> {
  const taskIds: string[] = []
  const db = createServiceClient()

  if (classification === "legal" || classification === "complaint") {
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
    }
  }

  await publish({
    type: "operational.record_populated", organization_id: organizationId,
    data: { entity_type: "task", entity_id: taskIds.join(","), source_document: documentId },
  })

  return taskIds
}

export async function getDocumentFeed(organizationId: string, limit = 50): Promise<Array<{
  id: string; name: string; type: string; classification: string | null
  status: string; task_count: number; created_at: string
}>> {
  const db = createServiceClient()
  const { data } = await db.from("documents")
    .select("id, name, type, classification, status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  return ((data ?? []) as Array<any>).map((d) => ({ ...d, task_count: 0 }))
}
