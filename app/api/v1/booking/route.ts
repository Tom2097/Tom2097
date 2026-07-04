import { withAuth } from "@/lib/auth/with-auth"
import { listSlots, createSlot, cancelSlot } from "@/lib/booking/engine"
import { NextResponse } from "next/server"

export const GET = withAuth(async (req, { organizationId }) => {
  const date = req.nextUrl.searchParams.get("date") || undefined
  const slots = await listSlots(organizationId, date)
  return NextResponse.json({ slots })
})

export const POST = withAuth(async (req, { organizationId, userId }) => {
  const input = await req.json()
  if (!input.resourceId || !input.title || !input.startTime || !input.endTime) {
    return NextResponse.json({ error: "Resource ID, title, start time, and end time are required" }, { status: 400 })
  }
  try {
    const slot = await createSlot(organizationId, userId, input)
    return NextResponse.json({ slot }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 })
  }
})

export const DELETE = withAuth(async (req, { organizationId }) => {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "Slot ID required" }, { status: 400 })
  const ok = await cancelSlot(organizationId, id)
  if (!ok) return NextResponse.json({ error: "Failed to cancel slot" }, { status: 500 })
  return NextResponse.json({ success: true })
})
