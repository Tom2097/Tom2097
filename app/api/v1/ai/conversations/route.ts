import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { listConversations } from "@/lib/ai/conversation-store"

/**
 * Module #5: List the current user's AI conversations within their org.
 */
export const GET = withAuth(async (_req, ctx) => {
  const conversations = await listConversations(ctx.organizationId, ctx.userId)
  return NextResponse.json({ conversations })
})
