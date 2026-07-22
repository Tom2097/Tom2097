"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getFeedbackStats, listFeedback, submitFeedback, validateFeedback } from "@/lib/feedback/engine"
import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type FeedbackStatus,
  type FeedbackType,
} from "@/lib/feedback/types"

// GET /api/v1/feedback - List feedback and get stats
export const GET = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || undefined
  const statusParam = searchParams.get('status')
  const status = FEEDBACK_STATUSES.includes(statusParam as FeedbackStatus)
    ? (statusParam as FeedbackStatus)
    : undefined
  const typeParam = searchParams.get('type')
  const type = FEEDBACK_TYPES.includes(typeParam as FeedbackType)
    ? (typeParam as FeedbackType)
    : undefined
  const sortParam = searchParams.get('sort')
  const sort = sortParam === 'recent' || sortParam === 'votes' ? sortParam : undefined
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100

  try {
    const [stats, items] = await Promise.all([
      getFeedbackStats(organizationId),
      listFeedback(organizationId, { search, status, type, sort, limit, offset: 0 })
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
export const POST = withAuth(async (req: NextRequest, { organizationId, userId }) => {
  try {
    const body = await req.json()
    const validationError = validateFeedback(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
    const feedback = await submitFeedback(organizationId, userId, body)
    return NextResponse.json(feedback)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create feedback" },
      { status: 500 }
    )
  }
})
