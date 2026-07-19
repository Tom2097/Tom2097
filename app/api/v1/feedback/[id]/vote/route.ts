"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { voteFeedback } from "@/lib/feedback/engine"

// POST /api/v1/feedback/[id]/vote - Toggle vote for feedback
export const POST = withAuth(async (_req: NextRequest, { params, organizationId, userId }) => {
  const { id } = params
  try {
    const result = await voteFeedback(organizationId, id, userId)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: "Failed to vote" }, { status: 500 })
  }
})
