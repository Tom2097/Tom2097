import { NextResponse } from "next/server"
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from "@/lib/auth/server-auth"
import { assertConversationOwnership, loadMessages } from "@/lib/ai/conversation-store"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * Get/delete a single AI assistant conversation. Ownership (organization_id +
 * user_id) is verified before any read or write -- a conversation belonging
 * to another tenant or another user in the same tenant returns 404, the same
 * response as a conversation that never existed, so existence isn't leaked.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { conversationId } = await params

    const owned = await assertConversationOwnership(conversationId, organizationId, user.id)
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const db = createServiceClient()
    const { data: conversation } = await db
      .from("ai_conversations")
      .select("id, title, created_at, updated_at")
      .eq("id", conversationId)
      .eq("organization_id", organizationId)
      .single()

    const messages = await loadMessages(conversationId, organizationId)

    return NextResponse.json({ ...conversation, messages })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { conversationId } = await params

    const owned = await assertConversationOwnership(conversationId, organizationId, user.id)
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const db = createServiceClient()
    await db
      .from("ai_conversations")
      .delete()
      .eq("id", conversationId)
      .eq("organization_id", organizationId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
