import { createServiceClient } from "@/lib/supabase/service"

/**
 * Real, deterministic computations backing the CRM "smart layer" tabs --
 * next-best-action, deal-health, duplicate detection, lead-source ROI,
 * vertical signals, event instrumentation. No AI calls here: these are
 * derivable directly from crm_deals/crm_contacts/crm_activities/crm_events,
 * so there is nothing to hallucinate. Narrative/text-generation tabs
 * (conversation intelligence, founder's briefing, whatsapp nurture,
 * ask-your-crm) live in the route itself, grounded in this same real data.
 */

const OPEN_STAGES = ["lead", "qualified", "proposal", "negotiation"] as const
const STALE_ACTION_BY_STAGE: Record<string, string> = {
  lead: "Send an introductory follow-up",
  qualified: "Schedule a discovery call",
  proposal: "Send a check-in email",
  negotiation: "Call to address open concerns",
}

async function dealsWithLastActivity(organizationId: string) {
  const db = createServiceClient()
  const { data: deals } = await db
    .from("crm_deals")
    .select("id,title,value,stage,updated_at")
    .eq("organization_id", organizationId)
    .in("stage", OPEN_STAGES)
  const rows = deals ?? []
  if (rows.length === 0) return []

  const { data: activities } = await db
    .from("crm_activities")
    .select("entity_id,created_at")
    .eq("organization_id", organizationId)
    .eq("entity_type", "deal")
    .in("entity_id", rows.map((d) => d.id))
    .order("created_at", { ascending: false })

  const lastActivity = new Map<string, string>()
  for (const a of activities ?? []) {
    if (!lastActivity.has(a.entity_id)) lastActivity.set(a.entity_id, a.created_at)
  }

  const now = Date.now()
  return rows.map((d) => {
    const last = lastActivity.get(d.id) ?? d.updated_at
    const daysSinceUpdate = Math.max(0, Math.round((now - new Date(last).getTime()) / (1000 * 60 * 60 * 24)))
    return { ...d, daysSinceUpdate }
  })
}

export async function computeNextBestActions(organizationId: string) {
  const deals = await dealsWithLastActivity(organizationId)
  return deals
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
    .slice(0, 5)
    .map((d) => ({
      id: d.id,
      deal: d.title,
      action: STALE_ACTION_BY_STAGE[d.stage] ?? "Follow up",
      impact: d.daysSinceUpdate > 14 || d.value > 50000 ? "high" : d.daysSinceUpdate > 7 ? "medium" : "low",
      reason: `No activity in ${d.daysSinceUpdate} day${d.daysSinceUpdate === 1 ? "" : "s"} at ${d.stage} stage`,
      channel: "email",
      value: d.value,
    }))
}

export async function computeDealHealth(organizationId: string) {
  const deals = await dealsWithLastActivity(organizationId)
  return deals
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
    .slice(0, 5)
    .map((d) => {
      const risk = d.daysSinceUpdate > 21 ? "high" : d.daysSinceUpdate > 7 ? "medium" : "low"
      return {
        id: d.id,
        deal: d.title,
        value: d.value,
        stage: d.stage,
        risk,
        reason: risk === "high" ? `Stalled at ${d.stage} for ${d.daysSinceUpdate} days` : risk === "medium" ? "Engagement slowing" : "On track",
        nextAction: STALE_ACTION_BY_STAGE[d.stage] ?? "Follow up",
        daysSinceUpdate: d.daysSinceUpdate,
      }
    })
}

function normalize(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ")
}

export async function computeDuplicates(organizationId: string) {
  const db = createServiceClient()
  const { data: contacts } = await db
    .from("crm_contacts")
    .select("id,first_name,last_name,email,phone,created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
  const rows = contacts ?? []

  const results: Array<{
    id: string; type: "contact"; name: string; email?: string; phone?: string; matchScore: number
    existing: { name: string; email?: string; phone?: string }
    fields: Array<{ field: string; value1: string; value2: string; match: boolean }>
  }> = []
  const claimed = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    if (claimed.has(rows[i].id)) continue
    for (let j = i + 1; j < rows.length; j++) {
      if (claimed.has(rows[j].id)) continue
      const a = rows[i], b = rows[j]
      const emailMatch = a.email && b.email && normalize(a.email) === normalize(b.email)
      const nameA = normalize(`${a.first_name} ${a.last_name}`)
      const nameB = normalize(`${b.first_name} ${b.last_name}`)
      const nameMatch = nameA.length > 0 && nameA === nameB
      const phoneMatch = a.phone && b.phone && a.phone.replace(/\D/g, "") === b.phone.replace(/\D/g, "")
      if (!emailMatch && !nameMatch && !phoneMatch) continue

      const matchScore = emailMatch ? 100 : phoneMatch ? 90 : 80
      results.push({
        id: b.id,
        type: "contact",
        name: `${b.first_name} ${b.last_name}`.trim(),
        email: b.email ?? undefined,
        phone: b.phone ?? undefined,
        matchScore,
        existing: { name: `${a.first_name} ${a.last_name}`.trim(), email: a.email ?? undefined, phone: a.phone ?? undefined },
        fields: [
          { field: "Name", value1: `${a.first_name} ${a.last_name}`.trim(), value2: `${b.first_name} ${b.last_name}`.trim(), match: nameMatch },
          { field: "Email", value1: a.email ?? "", value2: b.email ?? "", match: Boolean(emailMatch) },
          { field: "Phone", value1: a.phone ?? "", value2: b.phone ?? "", match: Boolean(phoneMatch) },
        ],
      })
      claimed.add(b.id)
      break
    }
  }
  return results.slice(0, 20)
}

export async function mergeDuplicateContact(organizationId: string, duplicateContactId: string): Promise<boolean> {
  const db = createServiceClient()
  const duplicates = await computeDuplicates(organizationId)
  const match = duplicates.find((d) => d.id === duplicateContactId)
  if (!match) return false

  const { data: primary } = await db
    .from("crm_contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("email", match.existing.email ?? "__none__")
    .neq("id", duplicateContactId)
    .limit(1)
    .maybeSingle()
  const primaryId = primary?.id
  if (!primaryId) return false

  await db.from("crm_deals").update({ contact_id: primaryId }).eq("contact_id", duplicateContactId).eq("organization_id", organizationId)
  await db.from("crm_activities").update({ entity_id: primaryId }).eq("entity_id", duplicateContactId).eq("entity_type", "contact").eq("organization_id", organizationId)
  await db.from("crm_communications").update({ contact_id: primaryId }).eq("contact_id", duplicateContactId).eq("organization_id", organizationId)
  await db.from("crm_contacts").delete().eq("id", duplicateContactId).eq("organization_id", organizationId)
  return true
}

export async function discardDuplicateContact(organizationId: string, contactId: string): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db.from("crm_contacts").delete().eq("id", contactId).eq("organization_id", organizationId)
  return !error
}

export async function computeLeadSourceRoi(organizationId: string) {
  const db = createServiceClient()
  const { data: deals } = await db
    .from("crm_deals")
    .select("source,stage,value")
    .eq("organization_id", organizationId)
  const rows = deals ?? []
  if (rows.length === 0) return []

  const bySource = new Map<string, { leads: number; won: number; closed: number; revenue: number }>()
  for (const d of rows) {
    const key = d.source?.trim() || "Unspecified"
    const bucket = bySource.get(key) ?? { leads: 0, won: 0, closed: 0, revenue: 0 }
    bucket.leads += 1
    if (d.stage === "won") { bucket.won += 1; bucket.revenue += d.value ?? 0 }
    if (d.stage === "won" || d.stage === "lost") bucket.closed += 1
    bySource.set(key, bucket)
  }

  return [...bySource.entries()].map(([source, b]) => ({
    source,
    leads: b.leads,
    conversion: b.closed > 0 ? Math.round((b.won / b.closed) * 100) : 0,
    revenue: b.revenue,
    cost: 0,
    roi: 0,
    trend: "stable" as const,
  }))
}

export async function computeVerticalSignals(organizationId: string) {
  const db = createServiceClient()
  const { data: deals } = await db
    .from("crm_deals")
    .select("value,created_at,company_id")
    .eq("organization_id", organizationId)
  const rows = deals ?? []
  if (rows.length === 0) return []

  const companyIds = [...new Set(rows.map((d) => d.company_id).filter(Boolean))] as string[]
  const { data: companies } = companyIds.length
    ? await db.from("crm_companies").select("id,industry").in("id", companyIds)
    : { data: [] }
  const industryOf = new Map((companies ?? []).map((c) => [c.id, c.industry || "Unclassified"]))

  const now = Date.now()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  const byIndustry = new Map<string, { deals: number; value: number; recentValue: number; priorValue: number }>()
  for (const d of rows) {
    const industry = d.company_id ? industryOf.get(d.company_id) ?? "Unclassified" : "Unclassified"
    const bucket = byIndustry.get(industry) ?? { deals: 0, value: 0, recentValue: 0, priorValue: 0 }
    bucket.deals += 1
    bucket.value += d.value ?? 0
    const age = now - new Date(d.created_at).getTime()
    if (age <= thirtyDays) bucket.recentValue += d.value ?? 0
    else if (age <= thirtyDays * 2) bucket.priorValue += d.value ?? 0
    byIndustry.set(industry, bucket)
  }

  return [...byIndustry.entries()].map(([name, b]) => {
    const growth = b.priorValue > 0 ? Math.round(((b.recentValue - b.priorValue) / b.priorValue) * 100) : b.recentValue > 0 ? 100 : 0
    return { name, deals: b.deals, value: b.value, growth, signals: [] as string[], trend: growth >= 0 ? ("up" as const) : ("down" as const) }
  })
}

export async function recordCrmEvent(organizationId: string, eventName: string, opts: { contactId?: string | null; dealId?: string | null; properties?: Record<string, unknown> } = {}) {
  const db = createServiceClient()
  await db.from("crm_events").insert({
    organization_id: organizationId,
    event_name: eventName,
    contact_id: opts.contactId ?? null,
    deal_id: opts.dealId ?? null,
    properties: opts.properties ?? {},
  })
}

const FUNNEL_ORDER = ["contact_created", "deal_created", "deal_won"]

export async function computeEventFunnel(organizationId: string) {
  const db = createServiceClient()
  const { data } = await db
    .from("crm_events")
    .select("event_name")
    .eq("organization_id", organizationId)
    .in("event_name", FUNNEL_ORDER)
  const rows = data ?? []
  const funnel = FUNNEL_ORDER.map((step) => ({ step, count: rows.filter((r) => r.event_name === step).length }))
  return funnel.every((f) => f.count === 0) ? [] : funnel
}

export interface BriefingFacts {
  pipelineValue: number
  wonThisMonth: number
  openDeals: number
  stalledDeals: Array<{ title: string; days: number }>
  topPerformers: Array<{ name: string; value: number }>
  openTasks: number
  openTickets: number
}

export async function gatherBriefingFacts(organizationId: string): Promise<BriefingFacts> {
  const db = createServiceClient()
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [{ data: deals }, { count: openTasks }, { count: openTickets }] = await Promise.all([
    db.from("crm_deals").select("title,value,stage,owner_id,closed_at,updated_at").eq("organization_id", organizationId),
    db.from("crm_tasks").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending"),
    db.from("support_tickets").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "open"),
  ])
  const rows = deals ?? []
  const openDeals = rows.filter((d) => OPEN_STAGES.includes(d.stage as (typeof OPEN_STAGES)[number]))
  const wonThisMonth = rows.filter((d) => d.stage === "won" && d.closed_at && d.closed_at >= startOfMonth).reduce((s, d) => s + (d.value ?? 0), 0)
  const now = Date.now()
  const stalledDeals = openDeals
    .map((d) => ({ title: d.title, days: Math.round((now - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24)) }))
    .filter((d) => d.days > 10)
    .sort((a, b) => b.days - a.days)
    .slice(0, 5)

  const ownerIds = [...new Set(rows.map((d) => d.owner_id).filter(Boolean))] as string[]
  const { data: owners } = ownerIds.length ? await db.from("profiles").select("id,full_name,email").in("id", ownerIds) : { data: [] }
  const ownerName = new Map((owners ?? []).map((o) => [o.id, o.full_name ?? o.email ?? "Unknown"]))
  const topPerformers = ownerIds
    .map((id) => ({ name: ownerName.get(id) ?? "Unknown", value: rows.filter((d) => d.owner_id === id).reduce((s, d) => s + (d.value ?? 0), 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)

  return {
    pipelineValue: openDeals.reduce((s, d) => s + (d.value ?? 0), 0),
    wonThisMonth,
    openDeals: openDeals.length,
    stalledDeals,
    topPerformers,
    openTasks: openTasks ?? 0,
    openTickets: openTickets ?? 0,
  }
}
