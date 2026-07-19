import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, requirePlatformAdmin, handleAuthError } from '@/lib/auth/server-auth'
import { requireIpAllowlisted } from '@/lib/auth/ip-allowlist'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    await requireIpAllowlisted(request)

    const db = createServiceClient()
    const [{ data: entries, error }, { data: setting }] = await Promise.all([
      db.from('ip_allowlist_entries').select('*').order('created_at', { ascending: false }),
      db.from('platform_settings').select('value').eq('key', 'ip_allowlist_enabled').maybeSingle(),
    ])

    if (error) {
      return NextResponse.json({ error: 'Failed to load IP allowlist' }, { status: 500 })
    }

    return NextResponse.json({
      entries: entries ?? [],
      enabled: Boolean((setting?.value as { enabled?: boolean } | undefined)?.enabled),
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    await requireIpAllowlisted(request)

    const body = await request.json()
    const db = createServiceClient()

    if (body.action === 'setEnabled') {
      const { error } = await db
        .from('platform_settings')
        .upsert({ key: 'ip_allowlist_enabled', value: { enabled: Boolean(body.enabled) }, updated_at: new Date().toISOString() })
      if (error) return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (!body.cidr?.trim()) {
      return NextResponse.json({ error: 'cidr is required' }, { status: 400 })
    }
    const { data: entry, error } = await db
      .from('ip_allowlist_entries')
      .insert({ cidr: body.cidr.trim(), description: body.description?.trim() ?? '' })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: 'Failed to add entry' }, { status: 500 })
    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    await requirePlatformAdmin(user.id)
    await requireIpAllowlisted(request)

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const db = createServiceClient()
    const { error } = await db.from('ip_allowlist_entries').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'Failed to remove entry' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
