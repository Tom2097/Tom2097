import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { checkUsageLimits, getUsageStatistics, trackUsage } from '@/lib/billing/usage-tracking'

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { hasExceeded, exceededLimits, usage } = await checkUsageLimits(organizationId)
    
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    const statistics = await getUsageStatistics(organizationId, startOfMonth, endOfMonth)
    
    return NextResponse.json({
      success: true,
      hasExceeded,
      exceededLimits,
      usage,
      statistics
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { feature, quantity } = await request.json()
    
    if (!feature || quantity === undefined) {
      return NextResponse.json(
        { error: 'Feature and quantity are required' },
        { status: 400 }
      )
    }
    
    await trackUsage(organizationId, feature, quantity)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}