import { type NextRequest, NextResponse } from "next/server"
import { runDueChecks } from "@/lib/monitoring/engine"

/**
 * Scheduled monitoring runner: POST (or GET) /api/v1/monitoring/run-due
 *
 * Invoked by an external scheduler (Vercel Cron). It is a system endpoint that
 * spans organizations, so it is NOT behind withAuth. Instead it requires the
 * CRON_SECRET bearer token (same convention as the retention and workflow
 * schedulers). Tenant scoping comes from each due monitor's own
 * organization_id, enforced inside the engine.
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

  try {
    const summary = await runDueChecks()
    return NextResponse.json(summary)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.log("[v0] monitoring run-due failed:", message)
    return NextResponse.json({ error: "monitoring run failed", message }, { status: 500 })
  }
}

export { handler as POST, handler as GET }
