
import { NextResponse, type NextRequest } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/auth/with-auth'
import { getRoutingSuggestions, saveRoutingRules } from '@/lib/operational/routing'

type AuthHandler = Parameters<typeof withAuth>[0]

async function getHandler(_req: NextRequest, { organizationId }: AuthContext) {
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    try {
      // In a real implementation, this would get the document content from request
      // For now, we'll return a placeholder response
      const suggestions = await getRoutingSuggestions(organizationId, "Sample document content for routing suggestions")
      
      return NextResponse.json({ suggestions })
    } catch (error) {
      console.error('[Routing] Error:', error)
      return NextResponse.json(
        { error: 'Failed to get routing suggestions' },
        { status: 500 }
      )
    }
}

async function postHandler(request: NextRequest, { organizationId }: AuthContext) {
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    try {
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
      console.error('[Routing] Error:', error)
      return NextResponse.json(
        { error: 'Failed to save routing rules' },
        { status: 500 }
      )
    }
}

export const GET = withAuth(getHandler as AuthHandler);
export const POST = withAuth(postHandler as AuthHandler);