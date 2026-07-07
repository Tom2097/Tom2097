import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET() {
  try {
    const db = createServiceClient()
    const { data } = await db
      .from("ai_conversations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const db = createServiceClient()

    const { data, error } = await db
      .from("ai_conversations")
      .insert({
        id: body.id || crypto.randomUUID(),
        title: body.title || "New conversation",
        messages: body.messages || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
