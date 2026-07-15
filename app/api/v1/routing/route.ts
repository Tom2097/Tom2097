import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getRoutingRules, getRoutingSuggestions, saveRoutingRules } from '@/lib/operational/routing'

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const rules = await getRoutingRules(organizationId)

    return NextResponse.json({ rules })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const body = await request.json()
    const action = body.action

    if (action === 'test-routing') {
      const content = typeof body.content === 'string' ? body.content.trim() : ''
      if (!content) {
        return NextResponse.json({ error: 'Document text is required' }, { status: 400 })
      }
      const suggestions = await getRoutingSuggestions(organizationId, content)
      return NextResponse.json({ suggestions })
    }

    const rules = body.rules
    if (!rules) {
      return NextResponse.json(
        { error: 'Routing rules are required' },
        { status: 400 }
      )
    }

    const success = await saveRoutingRules(organizationId, rules)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to save routing rules' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}