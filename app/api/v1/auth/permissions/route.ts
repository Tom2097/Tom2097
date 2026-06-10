import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { listPermissions } from "@/lib/auth/rbac"

/**
 * GET /api/v1/auth/permissions
 * Returns the global permission catalog. Requires roles:read.
 */
async function handler(_req: NextRequest, _ctx: AuthContext): Promise<NextResponse> {
  const permissions = await listPermissions()
  return NextResponse.json({ permissions })
}

export const GET = withAuth(handler, { requireAll: ["roles:read"] })
