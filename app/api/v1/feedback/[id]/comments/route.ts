"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getFeedback, createComment } from "@/lib/feedback/engine"

// GET /api/v1/feedback/[id]/comments - List comments for a feedback item
export const GET = withAuth(async (_req: NextRequest, { params, organizationId }) => {
  const { id } = params
  try {
    const feedback = await getFeedback(organizationId, id)
    if (!feedback) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 })
    }
    return NextResponse.json({ comments: feedback.comments ?? [] })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
})

// POST /api/v1/feedback/[id]/comments - Add a comment to a feedback item
export const POST = withAuth(async (req: NextRequest, { params, organizationId, userId }) => {
  const { id } = params
  try {
    const { text } = await req.json()
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 })
    }
    const comment = await createComment(organizationId, id, userId, text)
    return NextResponse.json({ comment })
  } catch (error) {
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 })
  }
})
