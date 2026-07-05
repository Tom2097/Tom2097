import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getFeatureFlags } from '@/lib/feature-flags'

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const flags = await getFeatureFlags(organizationId)
    return NextResponse.json(flags)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}