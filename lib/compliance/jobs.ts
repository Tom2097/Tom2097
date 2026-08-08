import { createServiceClient } from "@/lib/supabase/service"
import { registerJobHandler } from "@/lib/jobs/handlers"
import { broadcast } from "@/lib/notifications/engine"

/**
 * Runs when a capa.created event's job subscription fires
 * (event_job_subscriptions: capa.created -> compliance.notify_capa) --
 * i.e. automatically, whenever a CAPA record is genuinely inserted, whether
 * from the manual "log a CAPA" UI (lib/compliance/capa.ts's createCapa) or
 * the automatic legal/complaint-classified-document path
 * (lib/operational/auto-create.ts) -- both converge on createCapa(), which
 * is the single place that publishes capa.created, so one handler covers
 * both origins.
 *
 * capa_records.severity only ever takes "minor" | "major" | "critical"
 * (see the CHECK constraint added in
 * supabase/migrations/20260715000000_operations_action_layer.sql and the
 * CapaSeverity union in lib/compliance/capa.ts) -- there is no "high"
 * value in this schema. We treat "major" and "critical" -- the top two of
 * the three real levels -- as the trigger, which is the closest honest
 * match to the "high or critical" behavior asked for.
 */
registerJobHandler("compliance.notify_capa", async (organizationId, payload) => {
  const capaId = payload.capa_id as string | undefined
  const severity = payload.severity as string | undefined
  const framework = (payload.framework as string | null | undefined) ?? null
  if (!capaId || !severity) throw new Error("compliance.notify_capa job missing capa_id or severity")
  if (severity !== "major" && severity !== "critical") return

  const db = createServiceClient()
  const { data: capa } = await db
    .from("capa_records")
    .select("title, description")
    .eq("id", capaId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const capaTitle = (capa?.title as string | undefined) ?? null
  const capaDescription = (capa?.description as string | undefined) ?? null

  // monetary_risk has no real cost model behind it for CAPAs -- this is a
  // deliberately conservative severity-based placeholder, not a computed
  // financial figure, chosen to line up with the >50000 / >10000 thresholds
  // lib/intelligence/health.ts and app/api/v1/intelligence/aggregate/route.ts
  // already use to bucket findings into critical/warning/healthy.
  const monetaryRisk = severity === "critical" ? 75000 : 15000
  // Rule-derived, not a model guess -- 1.0 confidence is honest here (unlike
  // an AI-generated finding, this fired from a deterministic severity check).
  const confidence = 1
  const impactScore = severity === "critical" ? 0.9 : 0.6

  await db.from("intelligence_findings").insert({
    organization_id: organizationId,
    type: "capa_high_severity",
    title: capaTitle ? `${severity === "critical" ? "Critical" : "Major"} CAPA: ${capaTitle}` : `${severity === "critical" ? "Critical" : "Major"} severity CAPA created`,
    description: capaDescription
      ? capaDescription.slice(0, 500)
      : `A ${severity} severity CAPA was created${framework ? ` under ${framework}` : ""}.`,
    source_module: "compliance",
    entity_id: capaId,
    monetary_risk: monetaryRisk,
    impact_score: impactScore,
    confidence,
    status: "active",
    detected_at: new Date().toISOString(),
    suggested_action: "Review and prioritize this CAPA's corrective action plan.",
    requires_approval: true,
  })

  await broadcast(organizationId, {
    type: severity === "critical" ? "error" : "warning",
    category: "capa_high_severity",
    priority: severity === "critical" ? "urgent" : "high",
    title: capaTitle ? `${severity === "critical" ? "Critical" : "Major"} CAPA created: ${capaTitle}` : `${severity === "critical" ? "Critical" : "Major"} severity CAPA created`,
    body: capaDescription ? capaDescription.slice(0, 300) : undefined,
    data: { capa_id: capaId, severity, framework },
    source: "system",
  })
})
