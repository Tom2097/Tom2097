import { registerJobHandler } from "@/lib/jobs/handlers"
import { broadcast } from "@/lib/notifications/engine"

/**
 * Runs when an objective.at_risk event's job subscription
 * (event_job_subscriptions: objective.at_risk -> performance.notify_at_risk)
 * fires -- i.e. whenever lib/analytics/okr.ts's updateKeyResultValue (the
 * sole write path that recomputes an objective's status from its key
 * results, hit by PATCH app/api/v1/okr/objectives/[id]/key-results) finds an
 * objective genuinely transitioning INTO "at_risk", not one that was
 * already at_risk before this update.
 */
registerJobHandler("performance.notify_at_risk", async (organizationId, payload) => {
  const objectiveId = payload.objective_id as string | undefined
  const title = payload.title as string | undefined
  const pacingPct = payload.pacing_pct as number | undefined
  if (!objectiveId || pacingPct == null) throw new Error("performance.notify_at_risk job missing objective_id or pacing_pct")

  const label = title || objectiveId
  await broadcast(organizationId, {
    type: "warning",
    category: "objective_at_risk",
    priority: "high",
    title: `Objective at risk: ${label}`,
    body: `"${label}" is at ${pacingPct}% weighted progress, in the at-risk band.`,
    data: { objective_id: objectiveId, title: label, pacing_pct: pacingPct },
    source: "system",
  })
})
