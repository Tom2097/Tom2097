import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent } from "@/lib/auth/audit"
import { hasPermission } from "@/lib/auth/rbac"
import {
  startTrial,
  processTrialEnd,
  processRefund,
  cancelSubscription,
  getYearlyMilestone,
  acknowledgeYearlyReminder,
} from "@/lib/billing/subscription-lifecycle"

// POST /api/v1/billing/subscription/manage - Manage subscription lifecycle
const manage = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const canManage = await hasPermission(userId, "billing:manage")
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json()) as {
      action: string
      planId?: string
      provider?: string
    }
    const { action, planId } = body

    switch (action) {
      case "start-trial": {
        if (!planId) {
          return NextResponse.json({ error: "planId is required" }, { status: 400 })
        }
        const trial = await startTrial(organizationId, planId, userId)
        return NextResponse.json(trial)
      }

      case "end-trial": {
        const result = await processTrialEnd(organizationId)
        return NextResponse.json(result)
      }

      case "refund": {
        const result = await processRefund(organizationId, userId)
        return NextResponse.json(result, { status: result.success ? 200 : 400 })
      }

      case "cancel": {
        const result = await cancelSubscription(organizationId, userId)
        return NextResponse.json(result, { status: result.success ? 200 : 400 })
      }

      case "yearly-milestone": {
        const milestone = await getYearlyMilestone(organizationId)
        return NextResponse.json(milestone)
      }

      case "acknowledge-reminder": {
        await acknowledgeYearlyReminder(organizationId)
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    console.error("[v0] Subscription management failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = manage
