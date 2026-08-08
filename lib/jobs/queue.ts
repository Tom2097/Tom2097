import { createServiceClient } from "@/lib/supabase/service"

/**
 * The background jobs layer. Jobs are enqueued here (a plain INSERT, so
 * enqueueing never blocks the caller), and picked up by the poller
 * (app/api/v1/jobs/run-due, hit every minute by a Coolify Scheduled Task --
 * the same mechanism already proven by monitoring/run-due,
 * workflows/run-scheduled, etc.) which runs them outside the request that
 * enqueued them.
 */

export interface BackgroundJob {
  id: string
  organization_id: string
  job_type: string
  payload: Record<string, unknown>
  status: string
  attempts: number
  max_attempts: number
}

export async function enqueueJob(
  organizationId: string,
  jobType: string,
  payload: Record<string, unknown> = {},
  opts: { runAt?: Date; maxAttempts?: number } = {},
): Promise<string | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("background_jobs")
    .insert({
      organization_id: organizationId,
      job_type: jobType,
      payload,
      run_at: (opts.runAt ?? new Date()).toISOString(),
      max_attempts: opts.maxAttempts ?? 3,
    })
    .select("id")
    .single()
  if (error) {
    console.error("[jobs] enqueue failed:", error.message)
    return null
  }
  return data.id as string
}

/** Atomically claims up to `limit` due jobs via the claim_due_jobs() SQL
 *  function (UPDATE ... FOR UPDATE SKIP LOCKED under the hood), so two
 *  overlapping poller invocations can never claim the same job twice. */
export async function claimDueJobs(limit = 20): Promise<BackgroundJob[]> {
  const db = createServiceClient()
  const { data, error } = await db.rpc("claim_due_jobs", { p_limit: limit })
  if (error) {
    console.error("[jobs] claim failed:", error.message)
    return []
  }
  return (data ?? []) as BackgroundJob[]
}

export async function completeJob(id: string): Promise<void> {
  const db = createServiceClient()
  await db
    .from("background_jobs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id)
}

/** Requeues with a linear backoff if attempts remain, otherwise marks
 *  permanently failed. */
export async function failJob(id: string, error: string, attempts: number, maxAttempts: number): Promise<void> {
  const db = createServiceClient()
  if (attempts < maxAttempts) {
    await db
      .from("background_jobs")
      .update({ status: "pending", error, run_at: new Date(Date.now() + 30_000 * attempts).toISOString() })
      .eq("id", id)
  } else {
    await db
      .from("background_jobs")
      .update({ status: "failed", error, completed_at: new Date().toISOString() })
      .eq("id", id)
  }
}
