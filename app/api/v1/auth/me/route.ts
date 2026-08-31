import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's identity, tenant context, and
 * resolved RBAC permissions.
 */
async function handler(_req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, organization_id")
    .eq("id", ctx.userId)
    .single()

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role_id, roles(name, description)")
    .eq("user_id", ctx.userId)

  return NextResponse.json({
    user: {
      id: ctx.userId,
      email: ctx.email,
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
      profile: profile ?? null,
      roles: roles ?? [],
      permissions: ctx.permissions,
    },
  })
}

export const GET = withAuth(handler)
