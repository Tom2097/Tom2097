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

    return NextResponse.json(data || [])
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch actions" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const db = createServiceClient()
    const body = await request.json()

    const { data, error } = await db
      .from("agent_actions")
      .insert({
        id: body.id || crypto.randomUUID(),
        organization_id: body.organization_id,
        action_type: body.action_type,
        description: body.description,
        status: body.status || "pending",
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create action" },
      { status: 500 }
    )
  }
}
