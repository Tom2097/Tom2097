"use server"

import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { voteFeedback } from "@/lib/feedback/engine"

// POST /api/v1/feedback/vote - Vote for feedback
export const POST = withAuth(async (req: Request, { organizationId, userId }) => {
  try {
    const { feedbackId } = await req.json()
    const result = await voteFeedback(organizationId, feedbackId, userId)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to vote" },
      { status: 500 }
    )
  }
})