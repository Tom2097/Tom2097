import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { syncAllModules } from "@/lib/intelligence/sync"

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rateLimited = await checkTenantRateLimit(ctx.organizationId, 60, 10)
  if (rateLimited) return rateLimited

  const count = await syncAllModules(ctx.organizationId)
  return NextResponse.json({ synced: count, status: "ok" })
}
