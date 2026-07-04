import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

export const GET = withAuth(async (req, { organizationId }) => {
  const supabase = createServiceClient()
  const { data: capas } = await supabase
    .from("capa_records")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
  return NextResponse.json({ capas: capas || [] })
})

export const POST = withAuth(async (req, { organizationId, userId }) => {
  const { title, description, category, priority } = await req.json()
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase.from("capa_records").insert({
    organization_id: organizationId,
    title,
    description: description || "",
    category: category || "quality",
    priority: priority || "medium",
    state: "open",
    created_by: userId,
  }).select("*").single()

  if (error) return NextResponse.json({ error: "Failed to create CAPA" }, { status: 500 })
  return NextResponse.json({ capa: data }, { status: 201 })
})

export const PUT = withAuth(async (req, { organizationId, userId }) => {
  const { id, state, comment } = await req.json()
  if (!id || !state) return NextResponse.json({ error: "ID and state required" }, { status: 400 })

  const validTransitions: Record<string, string[]> = {
    open: ["investigation"],
    investigation: ["open", "action"],
    action: ["investigation", "verification"],
    verification: ["action", "closed"],
  }

  const supabase = createServiceClient()
  const { data: capa } = await supabase.from("capa_records").select("*").eq("id", id).eq("organization_id", organizationId).single()
  if (!capa) return NextResponse.json({ error: "CAPA not found" }, { status: 404 })

  const allowed = validTransitions[capa.state as string] || []
  if (!allowed.includes(state)) {
    return NextResponse.json({ error: `Cannot transition from ${capa.state} to ${state}` }, { status: 400 })
  }

  const { error } = await supabase.from("capa_records").update({ state, updated_at: new Date().toISOString(), comment: comment || null }).eq("id", id)
  if (error) return NextResponse.json({ error: "Failed to update CAPA" }, { status: 500 })

  return NextResponse.json({ success: true })
})
