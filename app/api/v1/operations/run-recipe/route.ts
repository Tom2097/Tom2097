import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

// Runs a catalog recipe (the vertical-specific recipe browser has no document
// context to process, so this queues a real, visible notification rather
// than fabricating a multi-step pipeline result with nothing to act on).
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { recipe, vertical } = await request.json()

    if (!recipe || typeof recipe !== 'string') {
      return NextResponse.json({ error: 'recipe is required' }, { status: 400 })
    }

    const db = createServiceClient()
    const { error } = await db.from('notifications').insert({
      organization_id: organizationId,
      type: 'recipe_queued',
      title: `Recipe queued: ${recipe}`,
      data: { recipe, vertical: vertical ?? null, queued_by: user.id },
    })

    if (error) {
      return NextResponse.json({ error: 'Failed to queue recipe' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
