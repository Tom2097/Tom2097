import { registerJobHandler } from "@/lib/jobs/handlers"
import { runFullAutoProvision } from "@/lib/crm/auto-provision"

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
