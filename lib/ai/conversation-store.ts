import { createServiceClient } from "@/lib/supabase/service"
import type { UIMessage } from "ai"
import { logger } from "@/lib/logging"

/**
 * Module #5: Conversation persistence.
 *
 * Stores AI assistant conversations and messages, always scoped to the
 * caller's organization id + user id from the verified auth context.
 * Writes go through the service-role client (RLS has SELECT-only policies),
 * but every query is manually scoped by organization_id and user_id.
 */

export interface ConversationSummary {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
}

/** Create a new conversation and return its id. */
export async function createConversation(
  organizationId: string,
  userId: string,
  title: string | null,
): Promise<string | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("ai_conversations")
    .insert({ organization_id: organizationId, user_id: userId, title })
    .select("id")
    .single()

  if (error) {
    logger.logError("[v0] createConversation error:", { error: error.message })
    return null
  }
  return data.id
}

/**
 * Verify a conversation belongs to this user + org. Returns false if not found
 * or not owned, preventing cross-tenant/cross-user access.
 */
export async function assertConversationOwnership(
  conversationId: string,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const db = createServiceClient()
  const { data } = await db
    .from("ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle()
  return Boolean(data)
}

/** List a user's conversations within their org, most recent first. */
export async function listConversations(
  organizationId: string,
  userId: string,
): Promise<ConversationSummary[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    console.warn("[v0] listConversations error:", error.message)
    return []
  }
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }))
}

/** Load persisted messages for a conversation as UIMessage[]. */
export async function loadMessages(
  conversationId: string,
  organizationId: string,
): Promise<UIMessage[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("ai_messages")
    .select("id, role, parts")
    .eq("conversation_id", conversationId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })

  if (error) {
    console.log("[v0] loadMessages error:", error.message)
    return []
  }
  return (data ?? []).map((m) => ({
    id: m.id,
    role: m.role as UIMessage["role"],
    parts: (m.parts ?? []) as UIMessage["parts"],
  }))
}

/** Replace the full message set for a conversation (used after each turn). */
export async function saveMessages(
  conversationId: string,
  organizationId: string,
  messages: UIMessage[],
): Promise<void> {
  const db = createServiceClient()

  // Simplest consistent strategy: clear and re-insert the conversation's messages.
  const { error: delError } = await db
    .from("ai_messages")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("organization_id", organizationId)

  if (delError) {
    console.log("[v0] saveMessages delete error:", delError.message)
    return
  }

  const rows = messages.map((m) => ({
    conversation_id: conversationId,
    organization_id: organizationId,
    role: m.role,
    parts: m.parts ?? [],
  }))

  if (rows.length > 0) {
    const { error: insError } = await db.from("ai_messages").insert(rows)
    if (insError) {
      console.log("[v0] saveMessages insert error:", insError.message)
      return
    }
  }

  await db
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
}
