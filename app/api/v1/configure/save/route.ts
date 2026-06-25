import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { extractTenantContext } from "@/lib/multitenant/context"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    const userId = ctx?.userId
    if (!orgId || !userId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const config = await request.json()
    if (!config.name || !config.vertical) {
      return NextResponse.json({ error: "name and vertical are required" }, { status: 400 })
    }

    const db = createServiceClient()
    const { data: existing } = await db.from("workspace_configs")
      .select("id")
      .eq("organization_id", orgId)
      .eq("vertical", config.vertical)
      .maybeSingle()

    let result
    if (existing) {
      const { data } = await db.from("workspace_configs")
        .update({ config, updated_by: userId, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("id")
        .single()
      result = data
    } else {
      const { data } = await db.from("workspace_configs")
        .insert({
          organization_id: orgId, vertical: config.vertical,
          name: config.name, config, created_by: userId,
        })
        .select("id")
        .single()
      result = data
    }

    return NextResponse.json({ success: true, id: result?.id })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to save configuration"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const db = createServiceClient()
    const { data } = await db.from("workspace_configs")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch configurations"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
