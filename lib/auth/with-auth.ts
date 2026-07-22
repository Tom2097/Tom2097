import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context.server"
import type { TenantContextMiddleware } from "@/lib/multitenant/types"
import { getUserPermissions } from "@/lib/auth/rbac"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"
import { resolveApiKeyAuth, apiKeyPermits } from "@/lib/auth/api-key"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"

/**
 * withAuth middleware (Module #2).
 * Composes Module #1's tenant context with RBAC permission checks and
 * audit logging. Identity is resolved one of two ways:
 *   - an "Authorization: Bearer <key>" header naming a live row in
 *     api_keys (see lib/auth/api-key.ts), or
 *   - failing that, the Supabase session cookie (via the JWT validated in
 *     extractTenantContext), same as before.
 * Dynamic permissions are layered on top either way, so a single
 * requireAll/requireAny check works for both auth methods.
 */

export interface AuthContext extends TenantContextMiddleware {
  permissions: string[]
  /** How this request authenticated. Absent/"session" for the original cookie flow. */
  authMethod?: "session" | "api_key"
  /** Set only when authMethod === "api_key". */
  apiKeyId?: string
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

    // 1. Validate tenant context + identity. An Authorization: Bearer <key>
    //    header takes precedence over the session cookie so server-to-server
    //    integrations authenticate without a browser session.
    const apiKeyAuth = await resolveApiKeyAuth(req)

    let tenantContext: TenantContextMiddleware | null
    let permissions: string[]
    let permitted: (permissionKey: string) => boolean
    let authMethod: "session" | "api_key"
    let apiKeyId: string | undefined

    if (apiKeyAuth) {
      authMethod = "api_key"
      apiKeyId = apiKeyAuth.apiKeyId
      tenantContext = {
        tenantId: apiKeyAuth.organizationId,
        organizationId: apiKeyAuth.organizationId,
        userId: apiKeyAuth.createdBy ?? `api-key:${apiKeyAuth.apiKeyId}`,
        email: "",
        role: apiKeyAuth.scopes.includes("write") ? "member" : "viewer",
        teamId: null,
      }
      // "Permissions" for a key are its raw scopes (e.g. ["read","write"]);
      // requireAll/requireAny is checked via apiKeyPermits() below instead of
      // exact set membership, since scopes are coarse and permission keys
      // are per-resource ("documents:read", "reports:write", ...).
      permissions = apiKeyAuth.scopes
      permitted = (permissionKey: string) => apiKeyPermits(permissionKey, apiKeyAuth.scopes)

      // A leaked/compromised key shouldn't be able to hammer the API without
      // limit. Reuse the existing distributed (Upstash-backed) tenant rate
      // limiter, keyed by the key's id rather than by tenant or IP.
      const rateLimited = await checkTenantRateLimit(`apikey:${apiKeyAuth.apiKeyId}`, 2000, 60)
      if (rateLimited) return rateLimited
    } else {
      authMethod = "session"
      tenantContext = await extractTenantContext(req)

      if (!tenantContext) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Invalid or missing authentication" },
          { status: 401 },
        )
      }

      // Resolve dynamic permissions for this user (Module #2 RBAC)
      permissions = await getUserPermissions(tenantContext.userId)
      const permSet = new Set(permissions)
      permitted = (permissionKey: string) => permSet.has(permissionKey)
    }

    // 2. Enforce permission requirements, if any
    const { requireAll, requireAny } = options

    const missingAll = requireAll?.filter((k) => !permitted(k)) ?? []
    const hasAny = requireAny ? requireAny.some((k) => permitted(k)) : true

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
          authMethod,
          apiKeyId,
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

    // 3. Invoke the handler with the enriched auth context
    const authContext: AuthContext = { ...tenantContext, permissions, authMethod, apiKeyId }
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
