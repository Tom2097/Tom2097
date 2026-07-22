"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { getFeedback, updateFeedback, deleteFeedback, validateFeedback } from "@/lib/feedback/engine"

// GET /api/v1/feedback/[id] - Get a single feedback item
export const GET = withAuth(async (_req: NextRequest, { params, organizationId }) => {
  const { id } = params
  try {
    const feedback = await getFeedback(organizationId, id)
    if (!feedback) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 })
    }
    return NextResponse.json({ feedback })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 })
  }
})

// PUT /api/v1/feedback/[id] - Update a feedback item
export const PUT = withAuth(async (req: NextRequest, { params, organizationId }) => {
  const { id } = params
  try {
    const body = await req.json()
    const validationError = validateFeedback(body, { requireTitle: false })
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
    const feedback = await updateFeedback(organizationId, id, body)
    return NextResponse.json({ feedback })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 })
  }
})

// DELETE /api/v1/feedback/[id] - Delete a feedback item
export const DELETE = withAuth(async (_req: NextRequest, { params, organizationId }) => {
  const { id } = params
  try {
    const ok = await deleteFeedback(organizationId, id)
    if (!ok) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete feedback" }, { status: 500 })
  }
})
