import { type NextRequest, NextResponse } from "next/server"
import { withAuth, type AuthContext } from "@/lib/auth/with-auth"
import { listRoles } from "@/lib/auth/rbac"
import { createClient } from "@/lib/supabase/server"
import { logAuthEvent, getClientIp } from "@/lib/auth/audit"

/**
 * GET /api/v1/auth/roles
 * List all roles for the caller's organization. Requires roles:read.
 */
async function listHandler(_req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const roles = await listRoles(ctx.organizationId)
  return NextResponse.json({ roles })
}

/**
 * POST /api/v1/auth/roles
 * Create a new custom role with an optional set of permission keys.
 * Requires roles:write.
 */
async function createHandler(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  let body: { name?: string; description?: string; permissionKeys?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: "Role name is required" }, { status: 400 })
  }

  const supabase = await createClient()

  // Create the role scoped to the caller's organization
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .insert({
      organization_id: ctx.organizationId,
      name,
      description: body.description ?? null,
      is_system: false,
    })
    .select()
    .single()

  if (roleError) {
    if (roleError.code === "23505") {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 })
    }
    console.log("[v0] create role error:", roleError.message)
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 })
  }

  // Attach permissions if provided
  if (body.permissionKeys && body.permissionKeys.length > 0) {
    const { data: perms } = await supabase
      .from("permissions")
      .select("id, key")
      .in("key", body.permissionKeys)

    if (perms && perms.length > 0) {
      await supabase.from("role_permissions").insert(
        perms.map((p) => ({ role_id: role.id, permission_id: p.id })),
      )
    }
  }

  await logAuthEvent({
    action: "rbac.role_created",
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    resourceType: "role",
    resourceId: role.id,
    metadata: { name, permissionKeys: body.permissionKeys ?? [] },
    ipAddress: getClientIp(req.headers),
  })

  return NextResponse.json({ role }, { status: 201 })
}

export const GET = withAuth(listHandler, { requireAll: ["roles:read"] })
export const POST = withAuth(createHandler, { requireAll: ["roles:write"] })
