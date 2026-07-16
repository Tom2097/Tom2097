import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const body = await request.json()
    const db = createServiceClient()

    if (body.action === 'feedback') {
      const { moduleId, helpful } = body as { moduleId?: string; helpful?: boolean }
      if (!moduleId || typeof helpful !== 'boolean') {
        return NextResponse.json({ error: 'moduleId and helpful are required' }, { status: 400 })
      }

      const { data: profile } = await db.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()

      const { error } = await db.from('recommendation_feedback').insert({
        organization_id: profile?.organization_id ?? null,
        user_id: user.id,
        module_id: moduleId,
        helpful,
      })
      if (error) {
        return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    if (body.action === 'complete') {
      const { selectedModules } = body as { selectedModules?: string[] }
      const { error } = await db
        .from('profiles')
        .update({
          selected_modules: Array.isArray(selectedModules) ? selectedModules : [],
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) {
        return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
