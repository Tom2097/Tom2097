import { createServiceClient } from "@/lib/supabase/service"

export type DomainEvent =
  | { type: "compliance.gap_detected"; organization_id: string; data: { gap_id: string; score: number; framework: string } }
  | { type: "compliance.capa_created"; organization_id: string; data: { capa_id: string; severity: string } }
  | { type: "compliance.capa_closed"; organization_id: string; data: { capa_id: string } }
  | { type: "compliance.cert_expiring"; organization_id: string; data: { cert_id: string; days_remaining: number } }
  | { type: "resources.asset_created"; organization_id: string; data: { asset_id: string; category: string } }
  | { type: "resources.low_stock"; organization_id: string; data: { item_id: string; current_qty: number; reorder_point: number } }
  | { type: "resources.maintenance_due"; organization_id: string; data: { asset_id: string; due_date: string } }
  | { type: "performance.anomaly_detected"; organization_id: string; data: { metric: string; deviation: number; severity: string } }
  | { type: "performance.threshold_breached"; organization_id: string; data: { metric: string; value: number; threshold: number } }
  | { type: "performance.report_generated"; organization_id: string; data: { report_id: string; report_type: string } }
  | { type: "operational.document_ingested"; organization_id: string; data: { document_id: string; classification: string } }
  | { type: "operational.record_populated"; organization_id: string; data: { entity_type: string; entity_id: string; source_document: string } }
  | { type: "workflow.started"; organization_id: string; data: { workflow_id: string; execution_id: string; trigger_type: string } }
  | { type: "workflow.completed"; organization_id: string; data: { workflow_id: string; execution_id: string; status: string } }

const SUBSCRIPTIONS_TABLE = "event_subscriptions"
const EVENTS_TABLE = "domain_events"

export async function publish(event: DomainEvent): Promise<void> {
  try {
    const db = createServiceClient()
    await db.from(EVENTS_TABLE).insert({
      organization_id: event.organization_id,
      event_type: event.type,
      data: event.data,
    })

    const { data: subs } = await db
      .from(SUBSCRIPTIONS_TABLE)
      .select("endpoint, secret")
      .eq("organization_id", event.organization_id)
      .eq("event_type", event.type)
      .eq("enabled", true)

    if (subs) {
      for (const sub of subs as Array<{ endpoint: string; secret: string | null }>) {
        fetch(sub.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Event-Type": event.type, "X-Signature": sub.secret ?? "" },
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(10000),
        }).catch(() => {})
      }
    }
  } catch (err) {
    console.log("[v0] event bus publish failed:", err)
  }
}

export async function subscribe(
  organizationId: string,
  eventType: string,
  endpoint: string,
  secret?: string,
): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db.from(SUBSCRIPTIONS_TABLE).insert({
    organization_id: organizationId,
    event_type: eventType,
    endpoint,
    secret: secret ?? null,
    enabled: true,
  })
  return !error
}
