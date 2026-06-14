import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { addPermissionToRole, removePermissionFromRole } from "@/lib/auth/rbac"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"

/** Extract the [roleId] segment from /api/v1/auth/roles/{roleId}/permissions. */
function roleIdFromPath(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean)
  return parts[parts.indexOf("roles") + 1] ?? ""
}

/**
 * POST /api/v1/auth/roles/[roleId]/permissions
 * Body: { permissionKey: string }
 * Adds a permission to the role. Requires roles:write.
 */
async function addHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const roleId = roleIdFromPath(req)

  let body: { permissionKey?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const permissionKey = body.permissionKey?.trim()
  if (!permissionKey) {
    return NextResponse.json({ error: "permissionKey is required" }, { status: 400 })
  }

  const ok = await addPermissionToRole(ctx.organizationId, roleId, permissionKey)
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to add permission (invalid role or permission key)" },
      { status: 400 },
    )
  }

  await logAuthEvent({
    action: "rbac.permission_added",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "role",
    resourceId: roleId,
    metadata: { permissionKey },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true })
}

/**
 * DELETE /api/v1/auth/roles/[roleId]/permissions
 * Body: { permissionKey: string }
 * Removes a permission from the role. Requires roles:write.
 */
async function removeHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const roleId = roleIdFromPath(req)

  let body: { permissionKey?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const permissionKey = body.permissionKey?.trim()
  if (!permissionKey) {
    return NextResponse.json({ error: "permissionKey is required" }, { status: 400 })
  }

  const ok = await removePermissionFromRole(ctx.organizationId, roleId, permissionKey)
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to remove permission (invalid role or permission key)" },
      { status: 400 },
    )
  }

  await logAuthEvent({
    action: "rbac.permission_removed",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "role",
    resourceId: roleId,
    metadata: { permissionKey },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ success: true })
}

export const POST = withAuth(addHandler, { requireAll: ["roles:write"] })
export const DELETE = withAuth(removeHandler, { requireAll: ["roles:write"] })
