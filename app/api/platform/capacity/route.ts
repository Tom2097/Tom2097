import { NextResponse } from "next/server"
import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { getPlatformCapacityReport } from "@/lib/platform/capacity-service"

/**
 * GET /api/platform/capacity
 *
 * Founder-only. Returns current platform capacity utilization and remaining
 * headroom. Gated by platform-owner email (PLATFORM_OWNER_EMAIL), NOT by
 * tenant RBAC — a tenant "admin" must never see cross-tenant aggregates.
 */
export async function GET() {
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) {
    return NextResponse.json(
      { error: "Forbidden", message: "Platform owner access required" },
      { status: 403 },
    )
  }

  try {
    const report = await getPlatformCapacityReport()
    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.log("[v0] capacity report error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to build capacity report" },
      { status: 500 },
    )
  }
}
