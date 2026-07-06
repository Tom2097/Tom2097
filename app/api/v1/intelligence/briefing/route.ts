import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getLatestBriefing, generateBriefing } from '@/lib/intelligence/briefing'

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const briefing = await getLatestBriefing(organizationId)
    if (!briefing) {
      return NextResponse.json(null)
    }

    return NextResponse.json({
      id: briefing.id,
      date: briefing.generatedAt,
      summary: briefing.summary,
      metrics: briefing.metrics,
      actionItems: briefing.actions,
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const briefing = await generateBriefing(organizationId)

    return NextResponse.json({
      id: briefing.id,
      date: briefing.generatedAt,
      summary: briefing.summary,
      metrics: briefing.metrics,
      actionItems: briefing.actions,
    })
  } catch (error) {
    console.error('[Briefing] Error generating briefing:', error)
    return handleAuthError(error as Error)
  }
}
