import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { runSimulation } from "@/lib/intelligence/simulation"

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.changes || !Array.isArray(body.changes)) {
    return NextResponse.json({ error: "changes array required" }, { status: 400 })
  }

  const result = await runSimulation({
    organizationId: ctx.organizationId,
    changes: body.changes,
    horizonDays: body.horizonDays || 90,
  })

  return NextResponse.json(result)
}
