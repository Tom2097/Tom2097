import { NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { createConversation, listConversations, saveMessages } from "@/lib/ai/conversation-store"
import type { UIMessage } from "ai"

/**
 * List/create AI assistant conversations, always scoped to the caller's own
 * organization + user id (lib/ai/conversation-store.ts -- Module #5).
 */

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const conversations = await listConversations(organizationId, user.id)
    return NextResponse.json(conversations)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === "string" && body.title.trim() ? body.title : "New conversation"

    const conversationId = await createConversation(organizationId, user.id, title)
    if (!conversationId) {
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
    }

    if (Array.isArray(body.messages) && body.messages.length > 0) {
      await saveMessages(conversationId, organizationId, body.messages as UIMessage[])
    }

    return NextResponse.json({ id: conversationId, title }, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
