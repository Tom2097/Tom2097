import { NextRequest, NextResponse } from "next/server"
import { generateAiResponse } from "@/lib/ai/helpers"
import { extractTenantContext } from "@/lib/multitenant/context"
import { checkTenantRateLimit } from "@/lib/multitenant/rate-limit"

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const rateLimited = await checkTenantRateLimit(ctx.organizationId, 30, 5)
  if (rateLimited) return rateLimited

  try {
    const { step, dealUrl, title } = await req.json()
    if (!step || !dealUrl) return NextResponse.json({ error: "step and dealUrl required" }, { status: 400 })

    const prompt = `Simulate the onboarding step "${title}" (step ${step}) for deal ${dealUrl}.
Describe what was done in 1 sentence. Return a JSON: { "status": "ok", "details": "..." }`

    const text = await generateAiResponse(prompt, "You are an automated provisioning system. Return only JSON.")
    if (!text || text.includes("error")) throw new Error("Provisioning step failed")
    return NextResponse.json({ status: "ok" })
  } catch {
    return NextResponse.json({ error: "Provisioning failed" }, { status: 500 })
  }
}