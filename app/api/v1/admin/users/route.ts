import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)

    const search = request.nextUrl.searchParams.get('search')?.trim()
    const db = createServiceClient()

    let query = db
      .from('profiles')
      .select('id, email, full_name, role, status, organization_id, created_at, organizations(name)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    }

    const { data: profiles, error } = await query
    if (error) {
      return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
    }

    const userIds = (profiles ?? []).map((p) => p.id)
    const { data: devices } = userIds.length
      ? await db.from('user_devices').select('user_id, last_used_at').in('user_id', userIds)
      : { data: [] }

    const deviceInfo = new Map<string, { count: number; lastUsed: string | null }>()
    for (const d of devices ?? []) {
      const entry = deviceInfo.get(d.user_id) ?? { count: 0, lastUsed: null }
      entry.count += 1
      if (!entry.lastUsed || (d.last_used_at && d.last_used_at > entry.lastUsed)) entry.lastUsed = d.last_used_at
      deviceInfo.set(d.user_id, entry)
    }

    const users = (profiles ?? []).map((p) => {
      const device = deviceInfo.get(p.id)
      return {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role,
        status: p.status,
        organization_name: (p.organizations as unknown as { name: string } | null)?.name ?? null,
        last_active: device?.lastUsed ?? null,
        mfa_enabled: Boolean(device && device.count > 0),
        created_at: p.created_at,
      }
    })

    return NextResponse.json({ users })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)

    const { action, userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const db = createServiceClient()

    if (action === 'suspend') {
      const { error } = await db.from('profiles').update({ status: 'suspended' }).eq('id', userId)
      if (error) return NextResponse.json({ error: 'Failed to suspend user' }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (action === 'activate') {
      const { error } = await db.from('profiles').update({ status: 'active' }).eq('id', userId)
      if (error) return NextResponse.json({ error: 'Failed to activate user' }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
