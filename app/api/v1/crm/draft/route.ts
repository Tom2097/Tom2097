import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { draftCrmMessage } from '@/lib/crm/ai-drafting'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const body = await request.json()
    if (!body.contextType) {
      return NextResponse.json({ error: 'contextType is required' }, { status: 400 })
    }

    const draft = await draftCrmMessage({ ...body, organizationId, userId: user.id })
    if (!draft) return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 })
    return NextResponse.json(draft)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
