import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import {
  createAbacRule,
  listAbacRules,
  deleteAbacRule,
  evaluateAbac,
  canAccess,
} from "@/lib/multitenant/abac"
import { extractTenantContext } from "@/lib/multitenant/context.server"

const handler = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const method = req.method

    if (method === "GET") {
      const role = req.nextUrl.searchParams.get("role") || undefined
      const rules = await listAbacRules(organizationId, role)
      return NextResponse.json({ rules })
    }

    const body = await req.json() as {
      action: "create" | "delete" | "evaluate"
      role?: string
      resourceType?: string
      accessLevel?: string
      conditions?: Array<{ field: string; operator: string; value: unknown }>
      priority?: number
      ruleId?: string
      // For evaluation
      resourceMetadata?: Record<string, unknown>
      userAttributes?: Record<string, unknown>
      requiredAccess?: string
    }

    switch (body.action) {
      case "create": {
        if (!body.role || !body.resourceType || !body.accessLevel) {
          return NextResponse.json({ error: "role, resourceType, and accessLevel required" }, { status: 400 })
        }
        const rule = await createAbacRule(
          organizationId,
          body.role,
          body.resourceType as any,
          body.accessLevel as any,
          (body.conditions || []) as any,
          body.priority || 100,
        )
        if (!rule) return NextResponse.json({ error: "Failed to create rule" }, { status: 500 })
        return NextResponse.json({ rule })
      }
      case "delete": {
        if (!body.ruleId) {
          return NextResponse.json({ error: "ruleId required" }, { status: 400 })
        }
        const deleted = await deleteAbacRule(organizationId, body.ruleId)
        return NextResponse.json({ deleted })
      }
      case "evaluate": {
        const ctx = await extractTenantContext()
        if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

        const access = await evaluateAbac({
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          role: ctx.role,
          resourceType: (body.resourceType || "document") as any,
          resourceMetadata: body.resourceMetadata || {},
          userAttributes: body.userAttributes || {},
        })

        const allowed = body.requiredAccess
          ? canAccess(body.requiredAccess as any, access)
          : access !== "deny"

        return NextResponse.json({ access, allowed })
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (err) {
    console.error("[abac] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export { handler as POST, handler as GET }
