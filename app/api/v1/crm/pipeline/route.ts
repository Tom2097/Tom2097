import { NextResponse } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getPipelineSummary } from '@/lib/crm/engine'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const summary = await getPipelineSummary(organizationId)
    return NextResponse.json(summary)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
