import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { broadcast } from '@/lib/notifications/engine'

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

    await broadcast(organizationId, {
      type: 'info',
      category: 'recipe_queued',
      title: `Recipe queued: ${recipe}`,
      data: { recipe, vertical: vertical ?? null, queued_by: user.id },
      source: 'app',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
