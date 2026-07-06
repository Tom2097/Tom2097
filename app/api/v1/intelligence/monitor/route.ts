import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { runAllMonitors, getMonitorStatus } from '@/lib/intelligence/monitor'

export async function GET(_req: NextRequest) {
  try {
    await getAuthenticatedUser()
    // Return a default summary; monitors are run via POST
    return NextResponse.json({
      summary: { total: 4, warnings: 0, critical: 0, healthy: 4 },
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const checks = await runAllMonitors(organizationId)
    const summary = getMonitorStatus(checks)

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('[Monitor] Error running monitors:', error)
    return handleAuthError(error as Error)
  }
}
