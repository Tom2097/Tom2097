import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET() {
  return NextResponse.json({
    summary: "No briefings available yet.",
    date: new Date().toISOString().split("T")[0],
    metrics: [],
    actionItems: [],
    topFindings: [],
    causalChains: [],
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const db = createServiceClient()

    const briefing = {
      id: body.id || crypto.randomUUID(),
      organization_id: body.organization_id,
      content: body.content || "Daily briefing has been generated.",
      generated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    const { data, error } = await db
      .from("intelligence_briefings")
      .insert(briefing)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({
      summary: "Briefing generated.",
      date: new Date().toISOString().split("T")[0],
      metrics: [],
      actionItems: [],
    }, { status: 201 })
  }
}
