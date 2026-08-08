/**
 * Side-effect-only module: importing it registers every domain's job
 * handlers (each domain file calls registerJobHandler() at module load).
 * The poller route (app/api/v1/jobs/run-due) imports this before claiming
 * any jobs, so every job_type it might see has a handler ready.
 */
import "@/lib/crm/jobs"
import "@/lib/compliance/jobs"
import "@/lib/resources/jobs"
