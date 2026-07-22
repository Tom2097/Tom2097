import { type NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { runDueChecks } from '@/lib/monitoring/engine'

/** Scheduled: runs all due monitor checks. Auth: Authorization: Bearer CRON_SECRET.
 *  This duplicated app/api/v1/monitoring/run-due/route.ts's job (same
 *  runDueChecks() call, which fetches every org's monitor targets) but
 *  without the cron-secret gate, so anyone could trigger it unauthenticated.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const summary = await runDueChecks()
    return NextResponse.json({ success: true, summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Monitor scan failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
