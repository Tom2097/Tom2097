import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/v1/auth/audit
 * Returns recent auth/RBAC audit events for the caller's organization.
 * Requires audit:read. Supports ?limit= (default 50, max 200).
 */
async function handler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "50")
  const limit = Math.min(Math.max(Number.isNaN(limitParam) ? 50 : limitParam, 1), 200)

  const supabase = await createClient()

  const { data: events, error } = await supabase
    .from("audit_logs")
    .select("id, action, user_id, resource_type, resource_id, metadata, ip_address, created_at")
    .eq("organization_id", ctx.organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.log("[v0] audit fetch error:", error.message)
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 })
  }

  return NextResponse.json({ events: events ?? [], count: events?.length ?? 0 })
}

export const GET = withAuth(handler, { requireAll: ["audit:read"] })
