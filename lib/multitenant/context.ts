import { cache } from "react"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * Tenant context (Module #1).
 *
 * SINGLE SOURCE OF TRUTH FOR IDENTITY:
 *   - WHO the caller is  → the Supabase Auth session (cookie-based, verified
 *     server-side by `supabase.auth.getUser()`).
 *   - WHICH org they belong to + their base role → the `profiles` row keyed by
 *     the authenticated user id.
 *
 * There are no hardcoded secrets, no custom JWT claims, and no client-supplied
 * `X-Tenant-ID` headers involved in scoping. The org id is resolved server-side
 * from `profiles` so it can never be spoofed by the caller. This is the same
 * session the browser app already uses, so the frontend and backend share one
 * identity model.
 */

export interface TenantContextMiddleware {
  tenantId: string
  organizationId: string
  userId: string
  email: string
  role: "admin" | "member" | "viewer"
}

function normalizeRole(role: string | null | undefined): "admin" | "member" | "viewer" {
  if (role === "admin" || role === "owner") return "admin"
  if (role === "viewer") return "viewer"
  return "member"
}

/**
 * Per-request memoized profile lookup. React's `cache()` dedupes calls with the
 * same userId within a single server request, so multiple components/handlers
 * resolving tenant context in one request hit the database only once. This is a
 * lightweight, dependency-free cache scoped to the request lifecycle — no stale
 * cross-request data is possible.
 */
const getProfileForUser = cache(async (userId: string) => {
  const db = createServiceClient()
  const { data, error } = await db
    .from("profiles")
    .select("organization_id, email, role")
    .eq("id", userId)
    .single()
  return { data, error }
})

/**
 * Resolve the authenticated tenant context for the current request.
 *
 * The `request` argument is accepted for backwards compatibility but identity is
 * derived entirely from the Supabase Auth session cookie, never from request
 * headers. Returns `null` (→ 401) when there is no valid session or the user has
 * no organization membership. Fails closed.
 */
export async function extractTenantContext(
  _request?: NextRequest,
): Promise<TenantContextMiddleware | null> {
  try {
    const supabase = await createClient()

    // 1. Verify the session against the auth server (not just decode a token).
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return null
    }

    // 2. Resolve org membership + base role from profiles (server-side, the
    //    authoritative source). Use the service client so an incomplete RLS
    //    policy set can never hide a user's own membership row. Memoized
    //    per-request so repeated context resolution costs a single query.
    const { data: profile, error: profileError } = await getProfileForUser(user.id)

    if (profileError || !profile?.organization_id) {
      console.log("[v0] extractTenantContext: no organization for user", user.id)
      return null
    }

    return {
      // tenantId is the organization id — DigiT is multi-organization, there is
      // no separate tenants table.
      tenantId: profile.organization_id,
      organizationId: profile.organization_id,
      userId: user.id,
      email: profile.email ?? user.email ?? "",
      role: normalizeRole(profile.role),
    }
  } catch (error) {
    console.log("[v0] Error extracting tenant context:", error)
    return null
  }
}

/**
 * Higher-order middleware to wrap API routes with tenant validation.
 * Prefer `withAuth` (Module #2) which also enforces RBAC permissions.
 */
export function withTenantContext(
  handler: (req: NextRequest, context: TenantContextMiddleware) => Promise<NextResponse>,
) {
  return async (req: NextRequest) => {
    const tenantContext = await extractTenantContext(req)

    if (!tenantContext) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing tenant context" },
        { status: 401 },
      )
    }

    try {
      return await handler(req, tenantContext)
    } catch (error) {
      console.log("[v0] Error in tenant-protected route:", error)
      return NextResponse.json(
        { error: "Internal Server Error", message: "An error occurred processing your request" },
        { status: 500 },
      )
    }
  }
}

/**
 * Get tenant context from request in API routes.
 * Must be called after withTenantContext middleware has attached it.
 */
export function getTenantContextFromRequest(request: NextRequest): TenantContextMiddleware | null {
  return (request as any).tenantContext || null
}
