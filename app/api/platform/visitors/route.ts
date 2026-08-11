import { NextResponse } from "next/server"
import { isCurrentUserPlatformOwner } from "@/lib/platform/owner"
import { getVisitorSnapshot } from "@/lib/analytics/site-visits"
import { logger } from "@/lib/logging"

/**
 * GET /api/platform/visitors
 *
 * Founder-only. Real visitor traffic (site_visits, written by the public
 * /api/v1/track/visit route) -- who's visiting the public site and from
 * where. Gated by platform-owner email, matching this console's own
 * convention (/api/platform/owner-check, /api/platform/payouts), not
 * tenant RBAC.
 */
export async function GET() {
  const isOwner = await isCurrentUserPlatformOwner()
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden", message: "Platform owner access required" }, { status: 403 })
  }

  try {
    const snapshot = await getVisitorSnapshot()
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    logger.logError("[v0] visitors snapshot error:", { error })
    return NextResponse.json({ error: "Internal Server Error", message: "Failed to build visitors snapshot" }, { status: 500 })
  }
}
