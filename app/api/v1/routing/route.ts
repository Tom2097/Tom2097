import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { getRoutingSuggestions, saveRoutingRules } from '@/lib/operational/routing'

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const suggestions = await getRoutingSuggestions(organizationId, "Sample document content for routing suggestions")
    
    return NextResponse.json({ suggestions })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { rules } = await request.json()
    
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