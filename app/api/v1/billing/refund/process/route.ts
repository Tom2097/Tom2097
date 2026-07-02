import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { processRefund } from "@/lib/billing/subscription-lifecycle"
import { hasPermission } from "@/lib/auth/rbac"

const processRefundHandler = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    // Check if user has billing:manage permission
    const canManage = await hasPermission(userId, "billing:manage")
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { targetOrganizationId } = await req.json()

    if (!targetOrganizationId) {
      return NextResponse.json({ error: "targetOrganizationId is required" }, { status: 400 })
    }

    const result = await processRefund(targetOrganizationId, userId)

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (err) {
    console.error("[v0] Refund processing failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = processRefundHandler