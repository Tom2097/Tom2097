import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { getActiveFindings } from "@/lib/intelligence/engine"
import { getTopFindings, rankFindings } from "@/lib/intelligence/ranking"
import { TTL, getCached, setCache } from "@/lib/intelligence/cache"

export async function GET(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10), 1), 100)
  const ranked = url.searchParams.get("ranked") === "true"
  const cacheKey = `findings:${ctx.organizationId}:${limit}:${ranked}`

  const cached = getCached<unknown>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const findings = await getActiveFindings(ctx.organizationId, limit)
  const result = ranked ? getTopFindings(findings, limit) : findings

  const response = { findings: result, total: findings.length }
  setCache(cacheKey, response, TTL.FINDINGS)
  return NextResponse.json(response)
}
