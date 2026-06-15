import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { logAuthEvent } from "@/lib/auth/audit"
import { deletePolicy, getPolicy, updatePolicy } from "@/lib/retention/engine"

/**
 * GET    /api/v1/retention/policies/[id]  – fetch one. retention:read
 * PATCH  /api/v1/retention/policies/[id]  – update. retention:write
 * DELETE /api/v1/retention/policies/[id]  – delete. retention:manage
 */
async function getHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const id = req.nextUrl.pathname.split("/").pop() as string
  const policy = await getPolicy(ctx.organizationId, id)
  if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 })
  return NextResponse.json({ policy })
}

async function patchHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const id = req.nextUrl.pathname.split("/").pop() as string
  const body = await req.json().catch(() => ({}))

  const policy = await updatePolicy(ctx.organizationId, id, body)
  if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 })

  await logAuthEvent({
    action: "retention.policy_updated",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "retention_policy",
    resourceId: policy.id,
    metadata: {
      resource_type: policy.resource_type,
      retention_days: policy.retention_days,
      is_enabled: policy.is_enabled,
    },
  })
  return NextResponse.json({ policy })
}

async function deleteHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const id = req.nextUrl.pathname.split("/").pop() as string
  const ok = await deletePolicy(ctx.organizationId, id)
  if (!ok) return NextResponse.json({ error: "Policy not found" }, { status: 404 })

  await logAuthEvent({
    action: "retention.policy_deleted",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "retention_policy",
    resourceId: id,
  })
  return NextResponse.json({ success: true })
}

export const GET = withAuth(getHandler, { requireAll: ["retention:read"] })
export const PATCH = withAuth(patchHandler, { requireAll: ["retention:write"] })
export const DELETE = withAuth(deleteHandler, { requireAll: ["retention:manage"] })
