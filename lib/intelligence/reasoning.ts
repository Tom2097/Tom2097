import { generateObject } from "ai"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"
import { registerJobHandler } from "@/lib/jobs/handlers"
import { mistralFastModel } from "@/lib/ai/mistral"
import { BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { publish } from "@/lib/events/bus"

/**
 * The "AI Intelligence" workspace's generic cross-workspace reasoning job.
 * Runs when ANY event mapped in event_job_subscriptions to
 * intelligence.reason_about_event fires (see the
 * 20260830000000_intelligence_reasoning_event_subscriptions.sql migration
 * for the curated event_type list this is wired to).
 *
 * Unlike lib/compliance/jobs.ts's compliance.notify_capa -- a FIXED
 * severity rule ("major/critical severity -> always create a finding") --
 * this is a real model call asked to judge, per event, whether it is
 * actually worth surfacing as a cross-workspace insight/risk. The honest,
 * expected outcome for most individual events is worthFlagging=false, in
 * which case nothing further happens: not every event is a finding, and
 * forcing one would be exactly the kind of fabrication this codebase's
 * grounded-AI pattern (lib/crm/smart-layer.ts + app/api/v1/ai/crm-query,
 * app/api/v1/intelligence/briefing) has been careful to avoid.
 *
 * Scope: this reasons over a SMALL window of real recent events for the
 * org (last RECENT_EVENTS_LIMIT domain_events rows) as lightweight context,
 * not a full causal graph -- causal_graph_nodes/causal_graph_edges exist in
 * the schema but are intentionally left untouched here; traversing/
 * populating them is a separate, bigger project.
 *
 * Cost/rate-limit note: the event_job_subscriptions allowlist this handler
 * is wired to IS the rate-limit/cost-control mechanism -- a deliberately
 * curated subset of event types (not "every event in the union"), chosen
 * to exclude high-volume/routine event types with little cross-workspace
 * signal on their own (audit log entries, e-signature step events, asset
 * scans, workflow starts, etc). At this app's real scale (a small
 * self-hosted deployment), that keeps AI-call volume low without needing a
 * separate rate-limiter table/mechanism, which would be over-engineering
 * for the traffic this app actually sees. See the migration file for the
 * full excluded-on-purpose list and reasoning. mistralFastModel (not the
 * larger DEFAULT_CHAT_MODEL) is used deliberately: this is a background
 * classification call, not an interactive user-facing generation, so the
 * cheaper model is the right tradeoff (same choice lib/document-processing/
 * analyze.ts makes for its background document classification call).
 */

const RECENT_EVENTS_LIMIT = 8

const ReasoningSchema = z.object({
  worthFlagging: z
    .boolean()
    .describe(
      "True ONLY if this event, in light of the recent event history below, represents a genuine cross-workspace risk or insight a human should see -- NOT true for routine, expected, or isolated activity with no cross-workspace signal.",
    ),
  reasoning: z
    .string()
    .describe(
      "1-3 sentences explaining the judgment, grounded ONLY in the real event and history provided below. Never invent facts, deals, documents, or amounts that are not listed.",
    ),
  title: z
    .string()
    .max(200)
    .describe("A short, human-readable title for the finding. Only meaningful when worthFlagging is true."),
  riskLevel: z
    .enum(["low", "medium", "high"])
    .describe("How severe this is if worthFlagging is true. Ignored otherwise."),
  estimatedMonetaryRisk: z
    .number()
    .min(0)
    .describe(
      "A monetary risk estimate, DERIVED from real numeric values present in the event or recent history (e.g. a deal's value, an inventory shortfall). Use 0 if no real number in the data below supports an estimate -- never invent a precise-sounding figure with no basis.",
    ),
})

type Reasoning = z.infer<typeof ReasoningSchema>

// Deterministic risk-level -> confidence/impact mapping (matching the
// pattern lib/compliance/jobs.ts already uses for its own severity-based
// finding: a coarse, honest number tied to a discrete judgment, not a
// fabricated-precision decimal asked of the model directly).
const CONFIDENCE_BY_RISK: Record<Reasoning["riskLevel"], number> = {
  low: 0.5,
  medium: 0.7,
  high: 0.85,
}
const IMPACT_BY_RISK: Record<Reasoning["riskLevel"], number> = {
  low: 0.3,
  medium: 0.6,
  high: 0.9,
}

// Common id-ish keys across DomainEvent payloads, checked in this order, so
// the finding can carry a real entity_id when the triggering event has one.
const ENTITY_ID_KEYS = [
  "deal_id",
  "capa_id",
  "gap_id",
  "cert_id",
  "asset_id",
  "item_id",
  "document_id",
  "workflow_id",
  "execution_id",
  "report_id",
  "signature_request_id",
]

function extractEntityId(eventData: Record<string, unknown>): string | null {
  for (const key of ENTITY_ID_KEYS) {
    const value = eventData[key]
    if (typeof value === "string" && value.length > 0) return value
  }
  return null
}

function summarizeRecentEvent(row: { event_type: string; data: unknown; created_at: string }): string {
  const dataStr = JSON.stringify(row.data ?? {})
  const truncated = dataStr.length > 300 ? `${dataStr.slice(0, 300)}…` : dataStr
  return `- [${row.created_at}] ${row.event_type}: ${truncated}`
}

registerJobHandler("intelligence.reason_about_event", async (organizationId, payload) => {
  const eventType = payload.eventType as string | undefined
  if (!eventType) throw new Error("intelligence.reason_about_event job missing eventType")

  // enqueueJob's payload is { eventType, ...event.data } (see
  // lib/events/bus.ts's publish()) -- strip eventType back off to recover
  // the original event's real data fields.
  const eventData: Record<string, unknown> = { ...payload }
  delete eventData.eventType

  const db = createServiceClient()
  const { data: recent } = await db
    .from("domain_events")
    .select("event_type, data, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(RECENT_EVENTS_LIMIT)

  const recentRows = (recent ?? []) as Array<{ event_type: string; data: unknown; created_at: string }>
  const historyText =
    recentRows.length > 0
      ? recentRows.map(summarizeRecentEvent).join("\n")
      : "(no other recent events recorded for this organization)"

  const eventText = `Event type: ${eventType}\nEvent data: ${JSON.stringify(eventData)}`

  let object: Reasoning
  try {
    const result = await generateObject({
      model: mistralFastModel,
      schema: ReasoningSchema,
      system: `${BASE_SYSTEM_PROMPT}\nYou are the AI Intelligence workspace's cross-workspace reasoning brain. You are shown ONE real event that just happened somewhere in the platform, plus a short real recent event history for the same organization. Judge causally, from these real facts ONLY -- never invent deals, documents, amounts, or events that are not listed below. Most individual events are routine and NOT worth flagging; only set worthFlagging=true when this event, in light of the recent history, points to a genuine cross-workspace risk or insight a human should see (e.g. a pattern spanning multiple modules, or a risk this event implies when combined with recent ones). Do not flag isolated, expected, routine activity just because it happened.`,
      prompt: `New event:\n${eventText}\n\nRecent event history for this organization (most recent first):\n${historyText}\n\nShould this be flagged as a cross-workspace insight or risk?`,
      temperature: 0.3,
    })
    object = result.object
  } catch (err) {
    // A transient model/API failure shouldn't be treated as "not worth
    // flagging" -- but it also shouldn't take down the poller run. Log and
    // let this job be retried by the queue's normal backoff (the poller
    // only retries on a thrown error, so surface one here).
    console.warn("[v0] intelligence.reason_about_event: generation failed:", err)
    throw err instanceof Error ? err : new Error("intelligence.reason_about_event generation failed")
  }

  if (!object.worthFlagging) return

  const confidence = CONFIDENCE_BY_RISK[object.riskLevel]
  const impactScore = IMPACT_BY_RISK[object.riskLevel]
  const monetaryRisk = Number.isFinite(object.estimatedMonetaryRisk) ? Math.max(0, object.estimatedMonetaryRisk) : 0
  const title = object.title.trim() || `Cross-workspace insight: ${eventType}`
  const description = object.reasoning.trim().slice(0, 500) || `Flagged from ${eventType} by the AI Intelligence workspace.`
  const entityId = extractEntityId(eventData)

  const { data: inserted, error } = await db
    .from("intelligence_findings")
    .insert({
      organization_id: organizationId,
      type: object.riskLevel === "high" ? "cross_workspace_risk" : "cross_workspace_insight",
      title,
      description,
      source_module: "intelligence",
      entity_id: entityId,
      monetary_risk: monetaryRisk,
      impact_score: impactScore,
      confidence,
      status: "active",
      detected_at: new Date().toISOString(),
      suggested_action: null,
      requires_approval: true,
    })
    .select("id")
    .single()

  if (error || !inserted) {
    console.warn("[v0] intelligence.reason_about_event: failed to insert finding:", error?.message)
    return
  }

  const findingId = inserted.id as string

  if (object.riskLevel === "high") {
    await publish({
      type: "risk.flagged",
      organization_id: organizationId,
      data: { finding_id: findingId, title, monetary_risk: monetaryRisk, source_event_type: eventType },
    })
  } else {
    await publish({
      type: "insight.generated",
      organization_id: organizationId,
      data: { finding_id: findingId, title, source_event_type: eventType },
    })
  }
})
