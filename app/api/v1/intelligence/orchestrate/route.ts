import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { resolveCommand, executeIntent } from "@/lib/intelligence/orchestrator"

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.query) {
    return NextResponse.json({ error: "query required" }, { status: 400 })
  }

  const command = await resolveCommand(body.query, ctx.organizationId)
  if (!command) {
    return NextResponse.json({ error: "Could not resolve intent" }, { status: 400 })
  }

  const result = await executeIntent(command, ctx.organizationId)
  return NextResponse.json(result)
}
