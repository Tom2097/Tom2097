import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { getAgents, BUILTIN_AGENTS } from "@/lib/intelligence/agents"

export async function GET(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const agents = await getAgents(ctx.organizationId)
  return NextResponse.json({ agents, builtin: BUILTIN_AGENTS })
}
