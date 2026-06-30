import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { getBrainHealth, getEngineStatus } from "@/lib/intelligence/health"
import { TTL, getCached, setCache } from "@/lib/intelligence/cache"

export async function GET(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cacheKey = `health:${ctx.organizationId}`
  const cached = getCached<unknown>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const [brain, engine] = await Promise.all([
    getBrainHealth(ctx.organizationId),
    getEngineStatus(),
  ])

  const result = { brain, engine }
  setCache(cacheKey, result, TTL.HEALTH)
  return NextResponse.json(result)
}
