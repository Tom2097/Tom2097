import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getActiveFindings } from '@/lib/intelligence/engine'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)

    const findings = await getActiveFindings(organizationId, isNaN(limit) ? 20 : limit)

    return NextResponse.json({ findings })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
