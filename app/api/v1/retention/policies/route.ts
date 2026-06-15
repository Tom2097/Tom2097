import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { logAuthEvent } from "@/lib/auth/audit"
import {
  createPolicy,
  listPolicies,
  listSupportedResourceTypes,
  validatePolicyInput,
} from "@/lib/retention/engine"
import type { RetentionResourceType } from "@/lib/retention/types"

/**
 * GET  /api/v1/retention/policies  – list policies (+ supported resource types). retention:read
 * POST /api/v1/retention/policies  – create a policy. retention:write
 */
async function getHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const resourceType = searchParams.get("resourceType") as RetentionResourceType | null
  const enabledOnly = searchParams.get("enabledOnly") === "true"

  const policies = await listPolicies(ctx.organizationId, {
    resourceType: resourceType ?? undefined,
    enabledOnly,
  })
  return NextResponse.json({ policies, supportedResourceTypes: listSupportedResourceTypes() })
}

async function postHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const body = await req.json().catch(() => null)
  const validationError = validatePolicyInput(body)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  try {
    const policy = await createPolicy(ctx.organizationId, ctx.userId, body)
    await logAuthEvent({
      action: "retention.policy_created",
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      resourceType: "retention_policy",
      resourceId: policy.id,
      metadata: { resource_type: policy.resource_type, retention_days: policy.retention_days },
    })
    return NextResponse.json({ policy }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to create policy"
    const status = message.includes("already exists") ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export const GET = withAuth(getHandler, { requireAll: ["retention:read"] })
export const POST = withAuth(postHandler, { requireAll: ["retention:write"] })
