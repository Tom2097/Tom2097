import { type NextRequest, NextResponse } from "next/server"
import { streamText } from "ai"
import { extractTenantContext } from "@/lib/multitenant/context"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { retrieveContext } from "@/lib/ai/rag"

/**
 * Module #5: AI content generation.
 *
 * Streams generated content (emails, summaries, descriptions, etc.) from a
 * prompt plus optional instructions. RAG-augmented and tenant-scoped via the
 * verified JWT context. Returns an SSE text stream.
 */

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Invalid or missing authentication" },
      { status: 401 },
    )
  }

  const body = await req.json().catch(() => null)
  const prompt: string = typeof body?.prompt === "string" ? body.prompt : ""
  const instructions: string = typeof body?.instructions === "string" ? body.instructions : ""
  const useContext: boolean = body?.useContext !== false // default true

  if (!prompt.trim()) {
    return NextResponse.json({ error: "Bad Request", message: "prompt required" }, { status: 400 })
  }

  let system = BASE_SYSTEM_PROMPT
  if (instructions.trim()) {
    system += `\n\nFollow these generation instructions:\n${instructions}`
  }
  if (useContext) {
    const { contextBlock } = await retrieveContext(ctx.organizationId, prompt)
    if (contextBlock) system += `\n\n${contextBlock}`
  }

  const result = streamText({
    model: DEFAULT_CHAT_MODEL,
    system,
    prompt,
  })

  return result.toUIMessageStreamResponse()
}
