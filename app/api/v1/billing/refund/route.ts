import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { processRefund } from '@/lib/billing/subscription-lifecycle'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { reason } = (await request.json()) as { reason?: string }

    const result = await processRefund(organizationId, user.id)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Refund request failed' }, { status: 400 })
    }

    return NextResponse.json({ success: true, reason: reason || null })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
