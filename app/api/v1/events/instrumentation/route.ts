import { NextRequest, NextResponse } from "next/server"
import { createFunnel, calculateRetention, trackEvent, type EventType, type TrackedEvent } from "@/lib/events/instrumentation"

const eventStore: Array<Record<string, unknown>> = []

export async function POST(req: NextRequest) {
  try {
    const { action, ...params } = await req.json()

    if (action === "track") {
      const event = trackEvent(params.event as EventType, params.userId, params.organizationId, params.sessionId, params.properties)
      eventStore.push(event as unknown as Record<string, unknown>)
      return NextResponse.json(event)
    }

    if (action === "funnel") {
      return NextResponse.json(createFunnel(params.events as EventType[]))
    }

    if (action === "retention") {
      return NextResponse.json(calculateRetention(eventStore as unknown as TrackedEvent[], params.cohortField))
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    tracked: eventStore.length, 
    events: eventStore.slice(-50) as unknown as Record<string, unknown>[]
  })
}
