import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { traceCausalChain, getCrossModuleChains } from "@/lib/intelligence/causal-chain"

export async function GET(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const entityId = url.searchParams.get("entityId")
  const crossModule = url.searchParams.get("crossModule") === "true"

  if (crossModule) {
    const chains = await getCrossModuleChains(ctx.organizationId)
    return NextResponse.json({ chains, total: chains.length })
  }

  if (!entityId) {
    return NextResponse.json({ error: "entityId query param required" }, { status: 400 })
  }

  const chain = await traceCausalChain(ctx.organizationId, entityId)
  return NextResponse.json(chain)
}
