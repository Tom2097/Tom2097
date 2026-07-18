import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractTenantContext } from "@/lib/multitenant/context.server"
import { logger } from "@/lib/logging"

export async function GET() {
  const ctx = await extractTenantContext()
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.userId)
      .is("read_at", null)

    if (error) throw error
    return NextResponse.json({ count: count ?? 0 })
  } catch (error) {
    logger.logError("[notifications] unread count failed", { error })
    return NextResponse.json({ error: "Unable to load notifications" }, { status: 500 })
  }
}
