import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { getRole, updateRole, deleteRole } from "@/lib/auth/rbac"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"

/** Extract the [roleId] segment from /api/v1/auth/roles/{roleId}. */
function roleIdFromPath(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  // .../auth/roles/{roleId}
  return parts[parts.indexOf("roles") + 1] ?? ""
}

/** GET /api/v1/auth/roles/[roleId] — role with permission keys. Requires roles:read. */
async function getHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const roleId = roleIdFromPath(req)
  const role = await getRole(ctx.organizationId, roleId)
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
  return NextResponse.json({ role })
}

/** PATCH /api/v1/auth/roles/[roleId] — update name/description. Requires roles:write. */
async function patchHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const roleId = roleIdFromPath(req)

  let body: { name?: string; description?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const role = await updateRole(ctx.organizationId, roleId, {
    name: body.name?.trim(),
    description: body.description,
  })
  if (!role) return NextResponse.json({ error: "Role not found or update failed" }, { status: 404 })

  await logAuthEvent({
    action: "rbac.role_updated",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "role",
    resourceId: roleId,
    metadata: { updates: body },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ role })
}

/** DELETE /api/v1/auth/roles/[roleId] — delete a non-system role. Requires roles:delete. */
async function deleteHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const roleId = roleIdFromPath(req)
  const ok = await deleteRole(ctx.organizationId, roleId)
  if (!ok) {
    return NextResponse.json(
      { error: "Cannot delete role (not found or system role)" },
      { status: 400 },
    )
  }

  await logAuthEvent({
    action: "rbac.role_deleted",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "role",
    resourceId: roleId,
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true })
}

export const GET = withAuth(getHandler, { requireAll: ["roles:read"] })
export const PATCH = withAuth(patchHandler, { requireAll: ["roles:write"] })
export const DELETE = withAuth(deleteHandler, { requireAll: ["roles:delete"] })
