import { registerJobHandler } from "@/lib/jobs/handlers"
import { runFullAutoProvision } from "@/lib/crm/auto-provision"
import { broadcast } from "@/lib/notifications/engine"

/**
 * Runs when a deal.won event's job subscription (event_job_subscriptions:
 * deal.won -> crm.auto_provision) fires -- i.e. automatically, whenever any
 * deal's stage flips to "won" (app/api/v1/crm/deals/route.ts), not just
 * when someone clicks the manual "Start" button in the CrmAutoProvision UI.
 */
registerJobHandler("crm.auto_provision", async (organizationId, payload) => {
  const dealId = payload.deal_id as string | undefined
  const actorId = payload.actor_id as string | undefined
  if (!dealId || !actorId) throw new Error("crm.auto_provision job missing deal_id or actor_id")
  await runFullAutoProvision(organizationId, dealId, actorId)
})

/**
 * Runs when a deal.stalled event's job subscription (event_job_subscriptions:
 * deal.stalled -> crm.notify_stalled) fires -- i.e. whenever the scheduled
 * poller (lib/crm/stalled.ts's runStalledDealCheck, hit by
 * app/api/v1/crm/deals/run-due) finds a deal that has genuinely just gone
 * stalled (not one it already notified about).
 */
registerJobHandler("crm.notify_stalled", async (organizationId, payload) => {
  const dealId = payload.deal_id as string | undefined
  const title = payload.title as string | undefined
  const daysStalled = payload.days_stalled as number | undefined
  if (!dealId || daysStalled == null) throw new Error("crm.notify_stalled job missing deal_id or days_stalled")

  const label = title ?? dealId
  await broadcast(organizationId, {
    type: "warning",
    category: "deal_stalled",
    priority: "high",
    title: `Deal stalled: ${label}`,
    body: `No activity on "${label}" for ${daysStalled} day${daysStalled === 1 ? "" : "s"}.`,
    data: { deal_id: dealId, title: label, days_stalled: daysStalled },
    source: "system",
  })
})
