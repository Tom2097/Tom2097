import { createServiceClient } from "@/lib/supabase/service"
import { enqueueJob } from "@/lib/jobs/queue"

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
  | { type: "document.version_created"; organization_id: string; data: { document_id: string; version: number; change_summary: string | null } }
  | { type: "compliance.signature_requested"; organization_id: string; data: { signature_request_id: string; document_id: string; signer_email: string } }
  | { type: "compliance.document_signed"; organization_id: string; data: { document_id: string; signer_email: string; signature_hash: string } }
  | { type: "compliance.signature_rejected"; organization_id: string; data: { signature_request_id: string; reason: string | null } }
  | { type: "compliance.audit_appended"; organization_id: string; data: { record_type: string; record_id: string; action: string; hash: string } }
  | { type: "resources.asset_tagged"; organization_id: string; data: { asset_id: string; tag_type: string; tag_id: string } }
  | { type: "resources.asset_scanned"; organization_id: string; data: { asset_id: string } }
  | { type: "deal.won"; organization_id: string; data: { deal_id: string; title: string; value: number; contact_id: string | null; company_id: string | null; actor_id: string } }
  | { type: "deal.stalled"; organization_id: string; data: { deal_id: string; title: string; days_stalled: number } }
  | { type: "capa.created"; organization_id: string; data: { capa_id: string; severity: string; framework?: string | null } }
  | { type: "inventory.low"; organization_id: string; data: { item_id: string; name: string; current_qty: number; reorder_point: number } }

const SUBSCRIPTIONS_TABLE = "event_subscriptions"
const EVENTS_TABLE = "domain_events"
const JOB_SUBSCRIPTIONS_TABLE = "event_job_subscriptions"

/**
 * Publishes a real domain event. Two independent things can happen as a
 * result, and publish() never waits on either of them to finish:
 *  1. Any org-registered external webhook subscription gets POSTed to
 *     (fire-and-forget, unchanged from before).
 *  2. Any internal job subscription (event_job_subscriptions -- a
 *     platform-wide, code-defined event_type -> job_type mapping) gets a
 *     background_jobs row enqueued, to be run later by the poller. This is
 *     what lets one module's action (e.g. CRM's deal.won) cause a
 *     DIFFERENT module's logic (e.g. auto-provisioning) to run
 *     automatically, asynchronously, outside the request that published it.
 */
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

    const { data: jobSubs } = await db
      .from(JOB_SUBSCRIPTIONS_TABLE)
      .select("job_type")
      .eq("event_type", event.type)
      .eq("enabled", true)

    for (const jobSub of (jobSubs ?? []) as Array<{ job_type: string }>) {
      await enqueueJob(event.organization_id, jobSub.job_type, { eventType: event.type, ...event.data })
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
