import { createServiceClient } from "@/lib/supabase/service"
import { publish } from "@/lib/events/bus"

// Same "high risk" threshold lib/crm/smart-layer.ts's computeDealHealth
// already uses to flag a deal risk:"high" on the Deal Health tab (days
// since the deal's last real crm_activities row, or its updated_at when it
// has none).
const STALLED_DAYS = 21
const OPEN_STAGES = ["lead", "qualified", "proposal", "negotiation"]

export interface StalledDealCheckSummary {
  scanned: number
  stalled: number
  newlyNotified: number
}

interface DealRow {
  id: string
  organization_id: string
  title: string
  updated_at: string
  stalled_notified_at: string | null
}

/**
 * Cross-tenant scheduled scan for genuinely stalled deals, run by the
 * Coolify-scheduled poller (app/api/v1/crm/deals/run-due), not a
 * single-write trigger -- "stalled" is a time-since-last-activity concept
 * (see lib/crm/smart-layer.ts's computeDealHealth, which flags the same
 * risk:"high" condition for its Deal Health tab and the AI briefing's
 * stalledDeals list), so unlike deal.won -- published the instant a deal's
 * stage flips to "won" in app/api/v1/crm/deals/route.ts -- it can only be
 * detected by periodically checking elapsed time, never from a single DB
 * write.
 *
 * Cross-tenant by design (mirrors lib/monitoring/engine.ts's
 * listDueMonitors/runDueChecks): each returned deal still carries its own
 * organization_id, which the publish() call below uses to preserve tenant
 * isolation.
 *
 * To avoid re-publishing deal.stalled every single poll for a deal that
 * simply remains stalled, crm_deals.stalled_notified_at (added by migration
 * 20260831000000_crm_okr_event_subscriptions.sql) tracks when a deal was
 * last flagged. A deal is (re-)published only when it has never been
 * notified, or it picked up new activity since the last notification (so
 * the notification timestamp no longer covers the deal's current silence)
 * and has now gone stalled again.
 */
export async function runStalledDealCheck(limit = 500): Promise<StalledDealCheckSummary> {
  const db = createServiceClient()
  const { data: deals } = await db
    .from("crm_deals")
    .select("id,organization_id,title,updated_at,stalled_notified_at")
    .in("stage", OPEN_STAGES)
    .limit(limit)

  const rows = (deals ?? []) as DealRow[]
  const summary: StalledDealCheckSummary = { scanned: rows.length, stalled: 0, newlyNotified: 0 }
  if (rows.length === 0) return summary

  const dealIds = rows.map((d) => d.id)
  const { data: activities } = await db
    .from("crm_activities")
    .select("entity_id,created_at")
    .eq("entity_type", "deal")
    .in("entity_id", dealIds)
    .order("created_at", { ascending: false })

  const lastActivity = new Map<string, string>()
  for (const a of (activities ?? []) as Array<{ entity_id: string; created_at: string }>) {
    if (!lastActivity.has(a.entity_id)) lastActivity.set(a.entity_id, a.created_at)
  }

  const now = Date.now()

  for (const deal of rows) {
    const last = lastActivity.get(deal.id) ?? deal.updated_at
    const daysStalled = Math.max(0, Math.round((now - new Date(last).getTime()) / 86400000))
    if (daysStalled < STALLED_DAYS) continue
    summary.stalled++

    const alreadyNotified = deal.stalled_notified_at != null && new Date(deal.stalled_notified_at).getTime() >= new Date(last).getTime()
    if (alreadyNotified) continue

    await publish({
      type: "deal.stalled",
      organization_id: deal.organization_id,
      data: { deal_id: deal.id, title: deal.title, days_stalled: daysStalled },
    })
    await db.from("crm_deals").update({ stalled_notified_at: new Date().toISOString() }).eq("id", deal.id)
    summary.newlyNotified++
  }

  return summary
}
