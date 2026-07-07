import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params
    const db = createServiceClient()
    const { data, error } = await db
      .from("ai_conversations")
      .select("*")
      .eq("id", conversationId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params
    const db = createServiceClient()
    await db.from("ai_conversations").delete().eq("id", conversationId)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    )
  }
}
