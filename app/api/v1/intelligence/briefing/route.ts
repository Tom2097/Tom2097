import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { createServiceClient } from "@/lib/supabase/service"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { z } from "zod"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { gatherBriefingFacts, computeVerticalSignals } from "@/lib/crm/smart-layer"

const briefingSchema = z.object({
  content: z.string().trim().min(1).max(50_000).optional(),
})

const BriefingGenerationSchema = z.object({
  summary: z.string().describe(
    "A 2-4 sentence executive summary of the organization's current state, written strictly from the real data provided -- never invent deals, contacts, or numbers not present in the facts."
  ),
  actionItems: z
    .array(
      z.object({
        title: z.string().describe("Short action title"),
        description: z.string().describe("One sentence describing the recommended action"),
        priority: z.enum(["high", "medium", "low"]),
        module: z.enum(["compliance", "resources", "crm", "operations"]).describe("Best-fit module for this action"),
      })
    )
    .max(6)
    .describe("Concrete follow-up actions derived only from the real facts below."),
})

/**
 * Real, grounded briefing generation -- same pattern as the "daily briefing"
 * branch of app/api/v1/ai/crm-query/route.ts: real facts are gathered
 * deterministically via lib/crm/smart-layer.ts (gatherBriefingFacts,
 * computeVerticalSignals; no model call for the numbers themselves), and the
 * model is only asked to summarize/recommend from those real facts -- never
 * to invent figures. If the org has no real pipeline/task/ticket activity
 * yet, we say so plainly instead of asking the model to write filler.
 */
async function generateGroundedBriefing(organizationId: string) {
  const [facts, verticals] = await Promise.all([
    gatherBriefingFacts(organizationId),
    computeVerticalSignals(organizationId),
  ])

  const hasAnyData =
    facts.openDeals > 0 || facts.openTasks > 0 || facts.openTickets > 0 || facts.pipelineValue > 0 || facts.wonThisMonth > 0

  const metrics = [
    { label: "Open Pipeline Value", value: facts.pipelineValue, change: 0, trend: "stable" as const },
    { label: "Won This Month", value: facts.wonThisMonth, change: 0, trend: "stable" as const },
    { label: "Open Deals", value: facts.openDeals, change: 0, trend: "stable" as const },
    { label: "Open Tasks", value: facts.openTasks, change: 0, trend: "stable" as const },
  ]

  if (!hasAnyData) {
    return {
      summary:
        "No pipeline, task, or ticket activity yet -- there isn't enough real data to generate a meaningful briefing. Add some deals, tasks, or tickets to get an executive summary.",
      metrics,
      actionItems: [] as Array<{ id: string; title: string; description: string; priority: string; module: string }>,
    }
  }

  const factsText = [
    `Open pipeline value: $${facts.pipelineValue.toLocaleString()}`,
    `Won this month: $${facts.wonThisMonth.toLocaleString()}`,
    `Open deals: ${facts.openDeals}`,
    `Stalled deals: ${facts.stalledDeals.map((d) => `${d.title} (${d.days}d stalled)`).join(", ") || "none"}`,
    `Top performers: ${facts.topPerformers.map((p) => `${p.name} ($${p.value.toLocaleString()})`).join(", ") || "none"}`,
    `Open tasks: ${facts.openTasks}`,
    `Open support tickets: ${facts.openTickets}`,
    `Vertical/industry momentum: ${verticals.map((v) => `${v.name} ${v.growth}% growth`).join(", ") || "none"}`,
  ].join("\n")

  try {
    const { object } = await generateObject({
      model: DEFAULT_CHAT_MODEL,
      schema: BriefingGenerationSchema,
      system: `${BASE_SYSTEM_PROMPT}\nYou write an executive daily briefing strictly from the real data provided. Never invent deals, contacts, tickets, or numbers that are not in the data below.`,
      prompt: `Write today's executive briefing summary and recommended action items.\n\nReal data:\n${factsText}`,
      temperature: 0.4,
    })
    return {
      summary: object.summary,
      metrics,
      actionItems: object.actionItems.map((item) => ({ id: crypto.randomUUID(), ...item })),
    }
  } catch (error) {
    console.error("[intelligence/briefing] generation failed, falling back to a facts-only summary:", error)
    return {
      summary: `Open pipeline: $${facts.pipelineValue.toLocaleString()} across ${facts.openDeals} deals. Won $${facts.wonThisMonth.toLocaleString()} this month. ${facts.openTasks} open tasks and ${facts.openTickets} open support tickets.`,
      metrics,
      actionItems: [] as Array<{ id: string; title: string; description: string; priority: string; module: string }>,
    }
  }
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const db = createServiceClient()
    const { data, error } = await db
      .from("intelligence_briefings")
      .select("id, date, summary, content, metrics, action_items, generated_at")
      .eq("organization_id", organizationId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (data) {
      return NextResponse.json({
        ...data,
        summary: data.summary || data.content,
        actionItems: data.action_items || [],
        topFindings: [],
        causalChains: [],
      })
    }

    return NextResponse.json({
      summary: "No briefings available yet.",
      date: new Date().toISOString().split("T")[0],
      metrics: [],
      actionItems: [],
      topFindings: [],
      causalChains: [],
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const parsed = briefingSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid briefing input" }, { status: 400 })
    }

    const db = createServiceClient()
    const now = new Date()

    // A client-supplied `content` (e.g. a manually authored briefing) is
    // honored verbatim since it's real, human-provided text -- otherwise we
    // generate a real, grounded briefing rather than a canned string.
    const generated = parsed.data.content
      ? { summary: parsed.data.content, metrics: [] as Array<{ label: string; value: number; change: number; trend: string }>, actionItems: [] as Array<{ id: string; title: string; description: string; priority: string; module: string }> }
      : await generateGroundedBriefing(organizationId)

    const briefing = {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      date: now.toISOString().split("T")[0],
      summary: generated.summary,
      content: generated.summary,
      metrics: generated.metrics,
      action_items: generated.actionItems,
      generated_at: now.toISOString(),
      created_at: now.toISOString(),
    }

    const { data, error } = await db
      .from("intelligence_briefings")
      .insert(briefing)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ ...data, actionItems: data.action_items || [] }, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
