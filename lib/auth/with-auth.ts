import { type NextRequest, NextResponse } from "next/server"
import {
  extractTenantContext,
  type TenantContextMiddleware,
} from "@/lib/multitenant/context.server"
import { getUserPermissions } from "@/lib/auth/rbac"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"

/**
 * withAuth middleware (Module #2).
 * Composes Module #1's tenant context with RBAC permission checks and
 * audit logging. Leans on Supabase Auth for identity (via the JWT validated
 * in extractTenantContext) and layers dynamic permissions on top.
 */

export interface AuthContext extends TenantContextMiddleware {
  permissions: string[]
}

export interface WithAuthOptions {
  /** Require ALL of these permission keys. */
  requireAll?: string[]
  /** Require ANY of these permission keys. */
  requireAny?: string[]
}

type AuthHandler = (req: NextRequest, context: AuthContext & { params: Record<string, string> }) => Promise<NextResponse>

/**
 * Wrap an API route handler with authentication + authorization.
 *
 * Usage:
 *   export const GET = withAuth(handler, { requireAll: ["roles:read"] })
 */
export function withAuth(handler: AuthHandler, options: WithAuthOptions = {}) {
  return async (req: NextRequest, routeContext?: { params: Record<string, string> | Promise<Record<string, string>> }): Promise<NextResponse> => {
    const resolvedParams = routeContext?.params ? await Promise.resolve(routeContext.params) : {}
    const resolvedContext = { params: resolvedParams }
    // 1. Validate tenant context + identity (Module #1)
    const tenantContext = await extractTenantContext(req)

    if (!tenantContext) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing authentication" },
        { status: 401 },
      )
    }

    // 2. Resolve dynamic permissions for this user (Module #2 RBAC)
    const permissions = await getUserPermissions(tenantContext.userId)

    // 3. Enforce permission requirements, if any
    const { requireAll, requireAny } = options
    const permSet = new Set(permissions)

    const missingAll = requireAll?.filter((k) => !permSet.has(k)) ?? []
    const hasAny = requireAny ? requireAny.some((k) => permSet.has(k)) : true

    if (missingAll.length > 0 || !hasAny) {
      await logAuthEvent({
        action: "auth.permission_denied",
        userId: tenantContext.userId,
        organizationId: tenantContext.organizationId,
        metadata: {
          path: req.nextUrl.pathname,
          requireAll,
          requireAny,
          missing: missingAll,
        },
        ipAddress: getClientIp(req.headers),
      })

      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You do not have permission to perform this action",
          required: { all: requireAll, any: requireAny },
        },
        { status: 403 },
      )
    }

    // 4. Invoke the handler with the enriched auth context
    const authContext: AuthContext = { ...tenantContext, permissions }
    const mergedContext = { ...authContext, ...resolvedContext }

    try {
      return await handler(req, mergedContext)
    } catch (error) {
      console.log("[v0] Error in auth-protected route:", error)
      return NextResponse.json(
        { error: "Internal Server Error", message: "An error occurred processing your request" },
        { status: 500 },
      )
    }
  }
}
