import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { z } from "zod"

const briefingSchema = z.object({
  content: z.string().trim().min(1).max(50_000).optional(),
})

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
    const content = parsed.data.content || "Daily briefing has been generated."

    const briefing = {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      date: now.toISOString().split("T")[0],
      summary: content,
      content,
      metrics: [],
      action_items: [],
      generated_at: now.toISOString(),
      created_at: now.toISOString(),
    }

    const { data, error } = await db
      .from("intelligence_briefings")
      .insert(briefing)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
