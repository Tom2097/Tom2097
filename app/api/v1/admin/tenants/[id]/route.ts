import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, handleAuthError } from "@/lib/auth/server-auth"
import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { checkIpAllowlist } from "@/lib/auth/ip-allowlist"
import { getTenantDetail, suspendTenant, activateTenant, deprovisionTenant } from "@/lib/platform/tenant-lifecycle"

// Real handler for the Platform Admin tenants page (app/(dashboard)/platform/admin/tenants/page.tsx),
// which PATCHes here with { action: "suspend" | "activate" | "delete" } to
// manage a single tenant. Reuses the same tenant-lifecycle helpers as the
// list route (app/api/v1/admin/tenants/route.ts) rather than raw queries.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthenticatedUser()
    const isOwner = await isCurrentUserPlatformOwner()
    if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const ipCheck = await checkIpAllowlist(request)
    if (!ipCheck.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const tenant = await getTenantDetail(id)
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    return NextResponse.json({ tenant })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getAuthenticatedUser()
    const isOwner = await isCurrentUserPlatformOwner()
    if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const ipCheck = await checkIpAllowlist(request)
    if (!ipCheck.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const body = await request.json()

    switch (body.action) {
      case "suspend":
        return NextResponse.json(await suspendTenant(id, body.reason || "Suspended by platform admin"))
      case "activate":
        return NextResponse.json(await activateTenant(id))
      case "delete":
      case "deprovision":
        return NextResponse.json(await deprovisionTenant(id))
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
