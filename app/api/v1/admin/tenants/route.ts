import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUser, handleAuthError } from "@/lib/auth/server-auth"
import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { checkIpAllowlist } from "@/lib/auth/ip-allowlist"
import { listTenants, suspendTenant, activateTenant, deprovisionTenant, getTenantDetail } from "@/lib/platform/tenant-lifecycle"

export async function GET(request: NextRequest) {
  try {
    await getAuthenticatedUser()
    const isOwner = await isCurrentUserPlatformOwner()
    if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const ipCheck = await checkIpAllowlist(request)
    if (!ipCheck.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get("id")
    
    if (tenantId) {
      const tenant = await getTenantDetail(tenantId)
      return NextResponse.json({ tenant })
    }
    
    const tenants = await listTenants()
    return NextResponse.json({ tenants })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUser()
    const isOwner = await isCurrentUserPlatformOwner()
    if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const ipCheck = await checkIpAllowlist(request)
    if (!ipCheck.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    
    switch (body.action) {
      case "suspend":
        return NextResponse.json(await suspendTenant(body.tenantId, body.reason))
      case "activate":
        return NextResponse.json(await activateTenant(body.tenantId))
      case "deprovision":
        return NextResponse.json(await deprovisionTenant(body.tenantId))
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
