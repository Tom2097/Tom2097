import { NextResponse } from "next/server"
import { generateText } from "ai"
import { FAST_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { extractTenantContext } from "@/lib/multitenant/context"
import { createServiceClient } from "@/lib/supabase/service"

export async function POST(request: Request) {
  try {
    const ctx = await extractTenantContext()
    if (!ctx) return NextResponse.json({ error: "Organization not found" }, { status: 403 })

    const { documentId } = await request.json()
    if (!documentId) return NextResponse.json({ error: "documentId is required" }, { status: 400 })

    const db = createServiceClient()
    const { data: doc } = await db.from("documents")
      .select("name, content, classification")
      .eq("id", documentId)
      .eq("organization_id", ctx.organizationId)
      .single()

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })

    const classification = doc.classification ?? "general"
    const content = (doc.content ?? "").slice(0, 3000)

    const systemPrompt = `${BASE_SYSTEM_PROMPT}
You are an intelligent suggestion engine for a business operations platform.
Given a document and its classification, suggest the next best actions a user should take.
Return ONLY a JSON array of objects: [{ "action": "action_name", "label": "Human readable label", "description": "Why this action" }]
Limit to 3-4 suggestions.`

    const result = await generateText({
      model: FAST_MODEL,
      system: systemPrompt,
      prompt: `Document: ${doc.name}\nClassification: ${classification}\nContent:\n"""\n${content}\n"""\n\nSuggest next actions:`,
      temperature: 0.3,
      maxOutputTokens: 800,
    })

    let suggestions: Array<{ action: string; label: string; description: string }> = []
    try {
      const jsonMatch = result.text.match(/\[[\s\S]*\]/)
      if (jsonMatch) suggestions = JSON.parse(jsonMatch[0])
    } catch {}

    return NextResponse.json({ success: true, data: suggestions })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to generate suggestions"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
