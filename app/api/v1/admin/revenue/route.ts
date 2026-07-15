import { NextResponse } from 'next/server'
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from '@/lib/auth/server-auth'
import { getRevenueMetrics, getChurnAnalysis, getRevenueForecast } from '@/lib/billing/revenue-analytics'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    const [metrics, churnAnalysis, forecast] = await Promise.all([
      Promise.resolve(getRevenueMetrics()),
      Promise.resolve(getChurnAnalysis()),
      Promise.resolve(getRevenueForecast()),
    ])
    return NextResponse.json({ metrics, churnAnalysis, forecast })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
