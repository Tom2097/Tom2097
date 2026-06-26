import { type NextRequest, NextResponse } from "next/server"
import { streamText, convertToModelMessages, type UIMessage } from "ai"
import { extractTenantContext } from "@/lib/multitenant/context"
import { BASE_SYSTEM_PROMPT } from "@/lib/ai/config"
import { mistralModel } from "@/lib/ai/mistral"
import { retrieveContext } from "@/lib/ai/rag"
import {
  createConversation,
  assertConversationOwnership,
  loadMessages,
  saveMessages,
} from "@/lib/ai/conversation-store"

/**
 * Module #5: Tenant-scoped streaming AI chat.
 *
 * POST: stream an assistant reply (RAG-augmented), persisting the conversation.
 * Identity + tenant come from the verified JWT context (Module #1), never the body.
 * Returns an SSE stream, so we validate tenant context inline rather than via
 * withAuth (which is typed for JSON NextResponse).
 */

export const maxDuration = 30

function latestUserText(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  if (!lastUser?.parts) return ""
  return lastUser.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

export async function POST(req: NextRequest) {
  const ctx = await extractTenantContext(req)
  if (!ctx) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Invalid or missing authentication" },
      { status: 401 },
    )
  }

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Bad Request", message: "messages[] required" }, { status: 400 })
  }

  const incoming = body.messages as UIMessage[]
  let conversationId: string | null = body.conversationId ?? null

  // Resolve or create the conversation (ownership enforced).
  if (conversationId) {
    const owned = await assertConversationOwnership(conversationId, ctx.organizationId, ctx.userId)
    if (!owned) {
      return NextResponse.json({ error: "Not Found", message: "Conversation not found" }, { status: 404 })
    }
  } else {
    const title = latestUserText(incoming).slice(0, 80) || "New conversation"
    conversationId = await createConversation(ctx.organizationId, ctx.userId, title)
    if (!conversationId) {
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
  }

  // Merge persisted history with the incoming messages for full context.
  const history = await loadMessages(conversationId, ctx.organizationId)
  const merged = [...history, ...incoming]

  // RAG: retrieve tenant context for the latest user message.
  const userText = latestUserText(incoming)
  const { contextBlock } = await retrieveContext(ctx.organizationId, userText)

  const system = contextBlock ? `${BASE_SYSTEM_PROMPT}\n\n${contextBlock}` : BASE_SYSTEM_PROMPT

  const result = streamText({
    model: mistralModel,
    system,
    messages: await convertToModelMessages(merged),
  })

  return result.toUIMessageStreamResponse({
    originalMessages: merged,
    onFinish: ({ messages }) => {
      // Persist the full updated conversation (fire-and-forget).
      void saveMessages(conversationId!, ctx.organizationId, messages)
    },
    headers: { "x-conversation-id": conversationId },
  })
}
