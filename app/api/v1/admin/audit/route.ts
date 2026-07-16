import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)

    const action = request.nextUrl.searchParams.get('action')
    const db = createServiceClient()

    let query = db
      .from('audit_logs')
      .select('id, action, resource_type, resource_id, user_id, ip_address, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(500)

    if (action && action !== 'all') {
      query = query.eq('action', action)
    }

    const { data: entries, error } = await query
    if (error) {
      return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 })
    }

    return NextResponse.json({ entries: entries ?? [] })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
