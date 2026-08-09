import { NextResponse, type NextRequest } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { actOnHAR } from "@/lib/hitl/har"
import type { HarDecision } from "@/lib/hitl/types"

const VALID_ACTIONS: HarDecision[] = ["approve", "reject", "edit", "request_info", "delegate", "escalate"]

/** Acting on a request (spec section 6) -- approve/reject/edit/request more
 *  info/delegate/escalate. Every real check (assignment, separation of
 *  duties, reason-required-on-reject) lives in lib/hitl/har.ts's
 *  actOnHAR() so the chat integration planned for later can call the exact
 *  same function and get the exact same guarantees (spec section 7's core
 *  rule: "the conversation is a client of the same orchestration API"). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { id } = await params

    const body = await request.json().catch(() => ({}))
    const action = body.action as string | undefined
    if (!action || !VALID_ACTIONS.includes(action as HarDecision)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const result = await actOnHAR({
      organizationId,
      harId: id,
      actorId: user.id,
      action: action as HarDecision,
      reason: typeof body.reason === "string" ? body.reason : null,
      delegateToUserId: typeof body.delegateToUserId === "string" ? body.delegateToUserId : null,
      channel: "in_app",
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to act on request" }, { status: 400 })
    }
    return NextResponse.json({ success: true, request: result.har })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
