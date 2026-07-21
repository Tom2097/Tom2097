import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"

// POST /api/v1/auth/team/transfer-ownership
// Body: { newOwnerUserId: string }
//
// Owner-only. Hands ownership to another org member and demotes the
// caller to admin in a single atomic operation (transfer_org_ownership()
// RPC added in supabase/migrations/20260825000000_owner_role.sql) so this
// can never leave the org with zero or multiple owners, even under
// concurrent calls.
async function transferHandler(
  req: NextRequest,
  ctx: AuthContext & { params: Record<string, string> },
): Promise<NextResponse> {
  if (ctx.role !== "owner") {
    return NextResponse.json({ error: "Only the current owner can transfer ownership" }, { status: 403 })
  }

  let body: { newOwnerUserId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const newOwnerUserId = body.newOwnerUserId?.trim()
  if (!newOwnerUserId) {
    return NextResponse.json({ error: "newOwnerUserId is required" }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: target, error: targetError } = await db
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", newOwnerUserId)
    .maybeSingle()

  if (targetError || !target || target.organization_id !== ctx.organizationId) {
    return NextResponse.json({ error: "Team member not found in your organization" }, { status: 404 })
  }

  if (target.role === "owner") {
    return NextResponse.json({ error: "This user is already the owner" }, { status: 400 })
  }

  const { data: success, error: rpcError } = await db.rpc("transfer_org_ownership", {
    p_organization_id: ctx.organizationId,
    p_current_owner_id: ctx.userId,
    p_new_owner_id: newOwnerUserId,
  })

  if (rpcError || !success) {
    console.error("[team/transfer-ownership] transfer_org_ownership failed:", rpcError)
    return NextResponse.json({ error: "Failed to transfer ownership" }, { status: 500 })
  }

  await logAuthEvent({
    action: "auth.ownership_transferred",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "profile",
    resourceId: newOwnerUserId,
    metadata: { previousOwnerId: ctx.userId, newOwnerId: newOwnerUserId },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({
    success: true,
    newOwnerId: newOwnerUserId,
    previousOwnerId: ctx.userId,
  })
}

export const POST = withAuth(transferHandler)
