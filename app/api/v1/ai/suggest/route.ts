import { NextResponse } from "next/server"
import { generateText, Output } from "ai"
import { z } from "zod"
import { withAuth } from "@/lib/auth/with-auth"
import { FAST_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { retrieveContext } from "@/lib/ai/rag"

/**
 * Module #5: AI next-step suggestions.
 *
 * Given a short context string (e.g. the current screen or last action),
 * returns a few concise, actionable suggestions. RAG-augmented and
 * tenant-scoped via the verified auth context.
 */

const suggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        title: z.string().describe("Short actionable label (max 6 words)"),
        detail: z.string().describe("One-sentence explanation of the suggestion"),
      }),
    )
    .describe("3-5 suggested next steps"),
})

export const POST = withAuth(async (req, ctx) => {
  const body = await req.json().catch(() => null)
  const context: string = typeof body?.context === "string" ? body.context : ""

  if (!context.trim()) {
    return NextResponse.json({ error: "Bad Request", message: "context required" }, { status: 400 })
  }

  const { contextBlock } = await retrieveContext(ctx.organizationId, context)
  const system = contextBlock ? `${BASE_SYSTEM_PROMPT}\n\n${contextBlock}` : BASE_SYSTEM_PROMPT

  const { experimental_output } = await generateText({
    model: FAST_MODEL,
    system,
    prompt: `Based on this context, suggest the most useful next steps for the user:\n\n${context}`,
    experimental_output: Output.object({ schema: suggestionsSchema }),
  })

  return NextResponse.json(experimental_output)
})
