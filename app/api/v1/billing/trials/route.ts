import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { startTrial, getTrialStatus, extendTrial } from '@/lib/billing/trials'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { planId } = await request.json()
    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 })
    }
    const trial = startTrial(organizationId, planId)
    return NextResponse.json({ success: true, trial })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = request.nextUrl.searchParams.get('orgId') || await getOrganizationId(user.id)
    const trial = getTrialStatus(organizationId)
    return NextResponse.json({ trial })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { extraDays } = await request.json()
    if (!extraDays || typeof extraDays !== 'number') {
      return NextResponse.json({ error: 'extraDays is required and must be a number' }, { status: 400 })
    }
    const trial = extendTrial(organizationId, extraDays)
    return NextResponse.json({ success: true, trial })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
