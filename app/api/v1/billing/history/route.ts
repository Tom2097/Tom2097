import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { hasPermission } from "@/lib/auth/rbac"

const handler = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const canView = await hasPermission(userId, "billing:view")
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 100)
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0")
    const provider = req.nextUrl.searchParams.get("provider")

    const supabase = await createServiceClient()

    let query = supabase
      .from("billing_events")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)

    if (provider && ["stripe", "razorpay"].includes(provider)) {
      query = query.eq("provider", provider)
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      events: data,
      total: count,
      limit,
      offset,
    })
  } catch (err) {
    console.error("[v0] Failed to fetch billing history:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const GET = handler
