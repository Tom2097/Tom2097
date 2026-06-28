import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { processAllDueTasks, ensureSchedules, executeTask, getTaskHistory } from "@/lib/intelligence/scheduler"

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (body?.action === "run-all") {
    const results = await processAllDueTasks()
    return NextResponse.json({ results, count: results.length })
  }

  if (body?.action === "run-task" && body?.task) {
    const results = await executeTask("manual", ctx.organizationId, body.task)
    return NextResponse.json(results)
  }

  if (body?.action === "ensure") {
    await ensureSchedules(ctx.organizationId)
    return NextResponse.json({ status: "ok" })
  }

  const results = await processAllDueTasks()
  return NextResponse.json({ results, count: results.length })
}

export async function GET(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20", 10), 100)
  const history = await getTaskHistory(ctx.organizationId, limit)
  return NextResponse.json({ tasks: history })
}
