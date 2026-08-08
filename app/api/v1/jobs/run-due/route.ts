import { type NextRequest, NextResponse } from "next/server"
import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { claimDueJobs, completeJob, failJob } from "@/lib/jobs/queue"
import { getJobHandler } from "@/lib/jobs/handlers"
import "@/lib/jobs/register-handlers"

/**
 * The background jobs layer's poller. Hit every minute by a Coolify
 * Scheduled Task (same mechanism as monitoring/run-due,
 * workflows/run-scheduled, etc.) -- claims due jobs and runs each through
 * its registered handler, outside the request that originally enqueued it.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const jobs = await claimDueJobs(20)
  const summary = { processed: 0, completed: 0, requeued: 0, failed: 0 }

  for (const job of jobs) {
    summary.processed++
    const handler = getJobHandler(job.job_type)

    if (!handler) {
      await failJob(job.id, `no handler registered for job_type "${job.job_type}"`, job.attempts, job.max_attempts)
      summary.failed++
      continue
    }

    try {
      await handler(job.organization_id, job.payload)
      await completeJob(job.id)
      summary.completed++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await failJob(job.id, message, job.attempts, job.max_attempts)
      if (job.attempts < job.max_attempts) summary.requeued++
      else summary.failed++
    }
  }

  return NextResponse.json({ success: true, ...summary })
}

export const POST = GET
