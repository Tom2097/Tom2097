import { NextRequest, NextResponse } from "next/server"
import { generateAiResponse } from "@/lib/ai/helpers"

export async function POST(req: NextRequest) {
  try {
    const { query, domain } = await req.json()
    if (!query || !domain) {
      return NextResponse.json({ error: "query and domain required" }, { status: 400 })
    }

    const prompt = `Research the company with domain "${domain}" and query "${query}".
Return a JSON object with these exact fields (no markdown, no backticks):
{
  "company_name": "Company name",
  "domain": "${domain}",
  "industry": "Primary industry",
  "size": "Employee count range (e.g. 50-200)",
  "revenue": "Revenue range (e.g. $10M-$50M)",
  "location": "HQ city and country",
  "description": "1-2 sentence company description",
  "recent_news": ["3 recent developments or news items about the company"]
}`

    const text = await generateAiResponse(prompt, "You are a business research assistant. Return ONLY valid JSON, no markdown.")
    if (!text) return NextResponse.json({ error: "AI service unavailable" }, { status: 503 })

    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim()
    const data = JSON.parse(cleaned)

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
