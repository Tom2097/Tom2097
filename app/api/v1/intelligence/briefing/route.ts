import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { generateBriefing, getLatestBriefing, getBriefingHistory } from "@/lib/intelligence/briefing"
import { TTL, getCached, setCache, invalidateCache } from "@/lib/intelligence/cache"

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rateLimited = await checkTenantRateLimit(ctx.organizationId, 60, 5)
  if (rateLimited) return rateLimited

  const briefing = await generateBriefing(ctx.organizationId)
  invalidateCache(`briefing:${ctx.organizationId}`)
  return NextResponse.json(briefing)
}

export async function GET(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const history = url.searchParams.get("history") === "true"

  if (history) {
    const briefings = await getBriefingHistory(ctx.organizationId)
    return NextResponse.json(briefings)
  }

  const cacheKey = `briefing:${ctx.organizationId}`
  const cached = getCached<unknown>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const briefing = await getLatestBriefing(ctx.organizationId)
  if (!briefing) return NextResponse.json({ message: "No briefing yet" }, { status: 404 })

  setCache(cacheKey, briefing, TTL.BRIEFING)
  return NextResponse.json(briefing)
}
