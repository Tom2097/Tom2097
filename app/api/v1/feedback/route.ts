"use server"

import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getFeedbackStats, listFeedback, submitFeedback, voteFeedback } from "@/lib/feedback/engine"

// GET /api/v1/feedback - List feedback and get stats
export const GET = withAuth(async (req: Request, { organizationId, userId }) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || undefined
  const status = searchParams.get('status') || undefined
  const type = searchParams.get('type') || undefined
  const sort = searchParams.get('sort') || undefined
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

  try {
    const [stats, items] = await Promise.all([
      getFeedbackStats(organizationId),
      listFeedback(organizationId, { search, status, type, sort, limit })
    ])
    return NextResponse.json({ stats, items })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    )
  }
})

// POST /api/v1/feedback - Create feedback
export const POST = withAuth(async (req: Request, { organizationId, userId }) => {
  try {
    const body = await req.json()
    const feedback = await submitFeedback(organizationId, userId, body)
    return NextResponse.json(feedback)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create feedback" },
      { status: 500 }
    )
  }
})

// POST /api/v1/feedback/vote - Vote for feedback
export const POST = withAuth(async (req: Request, { organizationId, userId, url }) => {
  if (url.pathname.endsWith('/vote')) {
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
  }
  
  // Default POST handler for creating feedback
  try {
    const body = await req.json()
    const feedback = await submitFeedback(organizationId, userId, body)
    return NextResponse.json(feedback)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create feedback" },
      { status: 500 }
    )
  }
})