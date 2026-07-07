import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET() {
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from("agent_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) throw error
    return NextResponse.json({ actions: data || [] })
  } catch {
    return NextResponse.json({ actions: [] })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const db = createServiceClient()
    const { id, organization_id, action_type, description } = body

    const { data, error } = await db
      .from("agent_actions")
      .insert({
        id: id || crypto.randomUUID(),
        organization_id,
        action_type,
        description,
        status: body.status || "pending",
        created_at: new Date().toISOString(),
      })
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
