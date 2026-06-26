import { NextRequest, NextResponse } from "next/server"
import { generateAiResponse } from "@/lib/ai/helpers"
import { extractTenantContext } from "@/lib/multitenant/context"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const rateLimited = await checkTenantRateLimit(ctx.organizationId, 60, 15)
  if (rateLimited) return rateLimited

  try {
    const { query } = await req.json()
    if (!query) return NextResponse.json({ error: "query required" }, { status: 400 })

    const prompt = `The user asked about their CRM data: "${query}"

Answer concisely in plain text (use markdown for formatting). If the question is about deals, pipeline, or forecasts, provide specific numbers. If you don't know the answer, suggest what the user can ask about (pipeline value, deals closing, conversion rates, at-risk deals).`

    const text = await generateAiResponse(prompt)
    return NextResponse.json({ response: text || "I'm not sure about that. Try asking about pipeline value, deals closing this month, or stage conversion rates." })
  } catch {
    return NextResponse.json({ error: "Query failed" }, { status: 500 })
  }
}