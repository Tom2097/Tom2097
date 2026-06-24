import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { extractTenantContext } from "@/lib/multitenant/context"

export async function GET() {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, type, classification, status, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) throw new Error(error.message)

    return NextResponse.json({ data: data ?? [] })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch feed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
