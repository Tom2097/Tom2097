import { NextResponse } from "next/server"
import { generateText } from "ai"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { extractTenantContext } from "@/lib/multitenant/context.server"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { createServiceClient } from "@/lib/supabase/service"
import { getPipelineSummary, listContacts, getContact, logActivity } from "@/lib/crm/engine"
import { createTask } from "@/lib/crm/extensions"
import {
  computeNextBestActions,
  computeDealHealth,
  computeDuplicates,
  computeLeadSourceRoi,
  computeVerticalSignals,
  computeEventFunnel,
  gatherBriefingFacts,
  mergeDuplicateContact,
  discardDuplicateContact,
} from "@/lib/crm/smart-layer"

/**
 * Every "smart layer" CRM tab (next-best-action, deal-health, duplicates,
 * conversation intelligence, lead-source ROI, vertical signals, founder's
 * briefing, event instrumentation, WhatsApp nurture, ask-your-CRM, plus the
 * merge/discard/execute action buttons) POSTs a free-text `query` to this one
 * endpoint -- there is no discriminator field, so the query text itself is
 * the dispatch key. Deterministic capabilities (numbers directly derivable
 * from crm_deals/crm_contacts/crm_events) are computed in lib/crm/smart-layer.ts,
 * no model call. Only genuinely generative pieces (conversation suggestions,
 * the daily narrative, nurture copy, free-form Q&A) call the model, and only
 * ever grounded in real data fetched here -- never asked to invent CRM facts.
 */

async function respond(payload: unknown) {
  return NextResponse.json({ response: JSON.stringify(payload) })
}

async function groundedText(prompt: string, facts: string): Promise<string> {
  const result = await generateText({
    model: DEFAULT_CHAT_MODEL,
    system: `${BASE_SYSTEM_PROMPT}\nYou answer strictly from the real data provided. Never invent deals, contacts, or numbers that are not in the data. If the data is empty, say so plainly rather than making something up. If the user's message is small talk or unrelated to the CRM data, respond briefly and naturally instead of reporting on the data.`,
    prompt: `${prompt}\n\nReal data:\n${facts}`,
    temperature: 0.4,
    maxOutputTokens: 1500,
  })
  return result.text.trim()
}

export async function GET() {
  return NextResponse.json([])
}

export async function POST(request: Request) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rateLimited = await checkTenantRateLimit(ctx.tenantId, 200, 20)
  if (rateLimited) return rateLimited

  const { query, contactId } = await request.json().catch(() => ({ query: "", contactId: undefined }))
  const q: string = query || ""
  const orgId = ctx.organizationId
  const db = createServiceClient()

  try {
    // ---- Action commands (checked before generation prompts) ----
    let m = q.match(/^Merge duplicate record (.+?) in CRM\.?$/i)
    if (m) {
      const ok = await mergeDuplicateContact(orgId, m[1].trim())
      return respond({ ok })
    }
    m = q.match(/^Discard duplicate record (.+?) in CRM\.?$/i)
    if (m) {
      const ok = await discardDuplicateContact(orgId, m[1].trim())
      return respond({ ok })
    }
    if (/^Keep both records for duplicate /i.test(q)) {
      return respond({ ok: true })
    }
    m = q.match(/^Execute (?:next )?action for deal "([^"]+)":\s*(.+)$/i)
    if (m) {
      const [, dealTitle, actionText] = m
      const { data: deal } = await db.from("crm_deals").select("id").eq("organization_id", orgId).ilike("title", dealTitle).limit(1).maybeSingle()
      if (deal) {
        await createTask(orgId, ctx.userId, { entity_type: "deal", entity_id: deal.id, title: actionText.trim(), priority: "high" })
        await logActivity(orgId, ctx.userId, { entity_type: "deal", entity_id: deal.id, type: "task", subject: actionText.trim() })
      }
      return respond({ ok: Boolean(deal) })
    }

    // ---- Real, deterministic data (no model call) ----
    if (/next best actions/i.test(q)) return respond(await computeNextBestActions(orgId))
    if (/deals with their health status|deal health/i.test(q)) return respond(await computeDealHealth(orgId))
    if (/scan crm for duplicate|duplicate contacts, accounts, deals/i.test(q)) return respond(await computeDuplicates(orgId))
    if (/lead source roi/i.test(q)) return respond(await computeLeadSourceRoi(orgId))
    if (/vertical industry|vertical buying/i.test(q)) return respond(await computeVerticalSignals(orgId))
    if (/event instrumentation/i.test(q)) {
      const funnel = await computeEventFunnel(orgId)
      return respond({ funnel })
    }

    // ---- Grounded generation ----
    if (/conversation intelligence/i.test(q)) {
      const { data: activities } = await db
        .from("crm_activities")
        .select("subject,body,type,entity_id")
        .eq("organization_id", orgId)
        .in("type", ["call", "email", "meeting"])
        .order("created_at", { ascending: false })
        .limit(15)
      if (!activities || activities.length === 0) return respond({ templates: [], sentiments: [], playbooks: [] })

      const facts = activities.map((a, i) => `${i + 1}. [${a.type}] ${a.subject}: ${(a.body ?? "").slice(0, 300)}`).join("\n")
      const text = await groundedText(
        `Generate conversation intelligence data. Return ONLY valid JSON with: templates (array of {id, name, scenario, suggested, objection, rebuttal} drawn from patterns in the logged interactions below), sentiments (array of {name, sentiment: 0-100, trend: "up"/"down", keywords: string[]}, one per distinct interaction subject), and playbooks (array of {id, name, stages: string[]} -- 2-3 outreach/deal playbooks whose stages reflect the actual interaction patterns seen below, not generic filler). No markdown.`,
        facts,
      )
      return NextResponse.json({ response: text })
    }

    if (/daily briefing/i.test(q)) {
      const [facts, verticals] = await Promise.all([gatherBriefingFacts(orgId), computeVerticalSignals(orgId)])
      const factsText = [
        `Open pipeline value: ${facts.pipelineValue}`,
        `Won this month: ${facts.wonThisMonth}`,
        `Open deals: ${facts.openDeals}`,
        `Stalled deals: ${facts.stalledDeals.map((d) => `${d.title} (${d.days}d)`).join(", ") || "none"}`,
        `Top performers: ${facts.topPerformers.map((p) => `${p.name} ($${p.value})`).join(", ") || "none"}`,
        `Open tasks: ${facts.openTasks}`,
        `Open support tickets: ${facts.openTickets}`,
        `Vertical/industry momentum: ${verticals.map((v) => `${v.name} ${v.growth}% growth`).join(", ") || "none"}`,
      ].join("\n")
      const text = await groundedText(
        `Generate a daily briefing for a founder. Return ONLY valid JSON array with 5 objects covering: 1) Revenue Pulse, 2) Deals Needing Attention, 3) Team Performance, 4) Market Signals, 5) Operational Health. Each object: title (string), priority ("high"/"medium"/"low"), content (string paragraph), actionItems (array of strings). No markdown, no backticks.`,
        factsText,
      )
      return NextResponse.json({ response: text })
    }

    if (/nurture sequences/i.test(q)) {
      const contacts = contactId
        ? [await getContact(orgId, contactId)].filter((c): c is NonNullable<typeof c> => c !== null)
        : (await listContacts(orgId, { status: "lead", limit: 3 })).contacts
      if (contacts.length === 0) return respond([])
      const facts = contacts.map((c, i) => `${i + 1}. id=${c.id}, name=${c.first_name} ${c.last_name}, title=${c.title ?? "unknown"}`).join("\n")
      const text = await groundedText(
        `Generate WhatsApp nurture sequences for these real CRM prospects only (use their given id as the sequence id, their given name as "prospect"). Return ONLY valid JSON array. Each item: {id: string, name: string, prospect: string, steps: [{day: number, channel: string, subject: string, content: string, delay: string}]}. No markdown.`,
        facts,
      )
      return NextResponse.json({ response: text })
    }

    // ---- Small talk / greetings: respond naturally, don't force a pipeline dump ----
    if (/^\s*(hi|hey|hello|yo|sup|good\s*(morning|afternoon|evening)|thanks|thank you|thx)[\s!.,]*$/i.test(q)) {
      return NextResponse.json({ response: "Hi! Ask me anything about your CRM data — for example \"which deals close this month?\", \"what's my pipeline value?\", or \"show me conversion by stage.\"" })
    }

    // ---- Fallback: ask-your-CRM free-form question ----
    const summary = await getPipelineSummary(orgId)
    const factsText = [
      `Total open pipeline value: ${summary.total_open_value} ${summary.currency}`,
      `Weighted open pipeline: ${summary.weighted_open_value} ${summary.currency}`,
      `Won value: ${summary.won_value} ${summary.currency}`,
      `Open deals: ${summary.open_deals}`,
      `By stage: ${summary.stages.map((s) => `${s.stage}=${s.count} deals worth ${s.value}`).join(", ")}`,
    ].join("\n")
    const text = await groundedText(q || "Summarize the current CRM pipeline.", factsText)
    return NextResponse.json({ response: text })
  } catch (error) {
    console.error("[ai/crm-query] error:", error)
    return NextResponse.json({ error: "Query failed" }, { status: 500 })
  }
}
