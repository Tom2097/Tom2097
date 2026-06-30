import { NextResponse } from "next/server"
import { processAllDueTasks } from "@/lib/intelligence/scheduler"

export const maxDuration = 300

export async function POST() {
  try {
    const results = await processAllDueTasks()
    return NextResponse.json({
      ok: true,
      tasksProcessed: results.length,
      completed: results.filter((r) => r.status === "completed").length,
      failed: results.filter((r) => r.status === "failed").length,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    service: "intelligence-scheduler",
    status: "ready",
    trigger: "POST /api/webhooks/cron",
  })
}
