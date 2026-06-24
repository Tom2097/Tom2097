import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { extractTenantContext } from "@/lib/multitenant/context"

export async function GET() {
  const ctx = await extractTenantContext()
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.userId)
      .is("read_at", null)

    if (error) {
      console.log("[v0] unread count error:", error.message)
      return NextResponse.json({ count: 0 })
    }

    return NextResponse.json({ count: data?.length ?? 0 })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
