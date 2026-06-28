import { type NextRequest, NextResponse } from "next/server"
import { extractTenantContext } from "@/lib/multitenant/context"
import { generateBriefing, getLatestBriefing, getBriefingHistory } from "@/lib/intelligence/briefing"

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const briefing = await generateBriefing(ctx.organizationId)
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

  const briefing = await getLatestBriefing(ctx.organizationId)
  if (!briefing) return NextResponse.json({ message: "No briefing yet" }, { status: 404 })

  return NextResponse.json(briefing)
}
