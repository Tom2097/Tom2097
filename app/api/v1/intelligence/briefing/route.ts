import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET() {
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from("intelligence_briefings")
      .select("*")
      .order("generated_at", { ascending: false })
      .limit(5)

    if (error) throw error
    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json([])
  }
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    )
  }
}
