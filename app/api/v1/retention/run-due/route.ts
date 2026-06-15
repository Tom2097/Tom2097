import { type NextRequest, NextResponse } from "next/server"
import { runDuePolicies } from "@/lib/retention/engine"

/**
 * Scheduled retention runner: POST (or GET) /api/v1/retention/run-due
 *
 * Designed to be invoked by an external scheduler (e.g. Vercel Cron). It is a
 * system endpoint that spans organizations, so it is NOT behind withAuth.
 * Instead it requires the CRON_SECRET bearer token (same convention as
 * Module #6's workflow scheduler). Tenant scoping comes from each due policy's
 * own organization_id.
 */
async function handler(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 500 },
    )
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results = await runDuePolicies()
  const purged = results.reduce((sum, r) => sum + r.deletedCount, 0)
  const failed = results.filter((r) => r.status === "failed").length

  return NextResponse.json({
    processed: results.length,
    totalDeleted: purged,
    failed,
    results,
  })
}

export { handler as POST, handler as GET }
