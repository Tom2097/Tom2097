import { NextResponse, type NextRequest } from "next/server"
import { getClientIp } from "@/lib/auth/audit"
import { recordVisit } from "@/lib/analytics/site-visits"

/**
 * Public, unauthenticated -- fired by components/analytics/visitor-tracker.tsx
 * via navigator.sendBeacon on every anonymous page view. Never throws: a
 * tracking failure must never surface to the visitor or break the page
 * they're on.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const path = typeof body.path === "string" ? body.path : null
    const referrer = typeof body.referrer === "string" ? body.referrer : null
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null

    if (!path || !sessionId) {
      return NextResponse.json({ error: "path and sessionId are required" }, { status: 400 })
    }

    const ip = getClientIp(request.headers)
    const userAgent = request.headers.get("user-agent")

    await recordVisit({ path, referrer, sessionId, ip, userAgent })

    return NextResponse.json({ ok: true })
  } catch {
    // Swallow -- see file header.
    return NextResponse.json({ ok: false })
  }
}
