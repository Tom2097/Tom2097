"use server"

import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/with-auth"
import { DOCUMENT_EVENT_TYPES, DOCUMENT_EVENT_DESCRIPTIONS } from "@/lib/documents/events"

// GET /api/v1/workflows/events - Event catalog for the workflow builder's
// "event" trigger type. Currently backed by the document-lifecycle events
// dispatched in lib/documents/events.ts (no other event source is wired
// into the workflow trigger engine yet).
export const GET = withAuth(async (_req: NextRequest) => {
  const events = DOCUMENT_EVENT_TYPES.map((type) => ({
    type,
    description: DOCUMENT_EVENT_DESCRIPTIONS[type],
  }))
  return NextResponse.json({ events })
})
