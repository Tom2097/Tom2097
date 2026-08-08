/**
 * Job handler registry. Each domain module registers its own handlers by
 * calling registerJobHandler() at module load time (see
 * lib/jobs/register-handlers.ts, which imports every domain's handler file
 * so registration happens before the poller route ever runs).
 */

export type JobHandler = (organizationId: string, payload: Record<string, unknown>) => Promise<void>

const registry: Record<string, JobHandler> = {}

export function registerJobHandler(jobType: string, handler: JobHandler): void {
  registry[jobType] = handler
}

export function getJobHandler(jobType: string): JobHandler | undefined {
  return registry[jobType]
}
