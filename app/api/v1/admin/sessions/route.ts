import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)

    const db = createServiceClient()
    const { data: rows, error } = await db
      .from('sessions')
      .select('id, user_id, ip_address, user_agent, created_at, expires_at')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 })
    }

    const userIds = [...new Set((rows ?? []).map((r) => r.user_id))]
    const { data: profiles } = userIds.length
      ? await db.from('profiles').select('id, email').in('id', userIds)
      : { data: [] }
    const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]))

    const sessions = (rows ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_email: emailById.get(r.user_id) ?? 'Unknown',
      created_at: r.created_at,
      expires_at: r.expires_at,
      ip_address: r.ip_address,
      user_agent: r.user_agent,
    }))

    return NextResponse.json({ sessions })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)

    const { action, sessionId } = await request.json()
    if (action !== 'revoke' || !sessionId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const db = createServiceClient()
    const { error } = await db.from('sessions').update({ is_active: false }).eq('id', sessionId)
    if (error) {
      return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
