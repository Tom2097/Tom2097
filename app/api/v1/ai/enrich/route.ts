import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { z } from "zod"
import { extractTenantContext } from "@/lib/multitenant/context.server"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"
import { mistralFastModel } from "@/lib/ai/mistral"

const EnrichmentSchema = z.object({
  company_name: z.string(),
  domain: z.string(),
  industry: z.string(),
  size: z.string().describe("Estimated employee count range, e.g. '50-200'"),
  revenue: z.string().describe("Estimated annual revenue range, e.g. '$10M-$50M'"),
  location: z.string().describe("Likely HQ city and country"),
  description: z.string().describe("1-2 sentence summary of what the company does"),
  recent_news: z.array(z.string()).describe("Up to 3 plausible recent developments or talking points for outreach"),
})

export async function GET() {
  return NextResponse.json([])
}

export async function POST(request: Request) {
  const ctx = await extractTenantContext()
  if (!ctx?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rateLimited = await checkTenantRateLimit(ctx.tenantId, 200, 20)
  if (rateLimited) return rateLimited

  const { query, domain } = (await request.json().catch(() => ({}))) as { query?: string; domain?: string }
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 })
  }

  try {
    const { object } = await generateObject({
      model: mistralFastModel,
      schema: EnrichmentSchema,
      prompt: `Research and infer a plausible business profile for this company/domain based on its name, industry conventions, and general public knowledge. If you don't have specific knowledge of this exact company, make a reasonable, clearly-labeled estimate rather than inventing overly specific false facts (e.g. prefer a size/revenue range over a fabricated exact figure).\n\nInput: "${query}"\nDomain: ${domain ?? "unknown"}`,
    })

    return NextResponse.json({ ...object, ai_generated: true })
  } catch (error) {
    console.error("[v1/ai/enrich] error:", error)
    return NextResponse.json({ error: "Enrichment failed" }, { status: 500 })
  }
}
