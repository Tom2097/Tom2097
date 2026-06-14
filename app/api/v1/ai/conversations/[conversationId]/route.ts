import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { assertConversationOwnership, loadMessages } from "@/lib/ai/conversation-store"

/**
 * Module #5: Fetch a single conversation's message history.
 * Ownership is enforced against the verified org + user context.
 */
export const GET = withAuth(async (req, ctx) => {
  const conversationId = req.nextUrl.pathname.split("/").filter(Boolean).pop() as string

  const owned = await assertConversationOwnership(conversationId, ctx.organizationId, ctx.userId)
  if (!owned) {
    return NextResponse.json({ error: "Not Found", message: "Conversation not found" }, { status: 404 })
  }

  const messages = await loadMessages(conversationId, ctx.organizationId)
  return NextResponse.json({ conversationId, messages })
})
