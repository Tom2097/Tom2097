import { type NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cron/auth'
import { runDueChecks, runOrgChecks } from '@/lib/monitoring/engine'
import { getAuthenticatedUser, getOrganizationId } from '@/lib/auth/server-auth'

/**
 * Two callers hit this route: the Coolify cron scheduler (Authorization:
 * Bearer CRON_SECRET), which scans every org's due monitors, and a signed-in
 * user clicking "Run Monitor Scan" in the Intelligence command center /
 * command palette, which must only ever touch that user's own org -- letting
 * an ordinary user trigger a scan across every tenant would be a real
 * cross-tenant amplification vector, which is exactly why this route used to
 * require the cron secret unconditionally (that closed the vulnerability but
 * also 401'd every real user click, since browsers never send it).
 */
export async function POST(req: NextRequest) {
  if (isAuthorizedCronRequest(req)) {
    try {
      const summary = await runDueChecks()
      return NextResponse.json({ success: true, summary })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Monitor scan failed'
      return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
  }

  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const summary = await runOrgChecks(organizationId)
    return NextResponse.json({ success: true, summary })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
