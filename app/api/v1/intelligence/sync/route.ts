import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { syncAllModules } from "@/lib/intelligence/sync"

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const count = await syncAllModules(ctx.organizationId)
  return NextResponse.json({ synced: count, status: "ok" })
}
