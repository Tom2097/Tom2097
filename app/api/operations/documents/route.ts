import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractTenantContext } from '@/lib/multitenant/context.server'

export async function GET() {
  try {
    const ctx = await extractTenantContext()
    if (!ctx?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from('documents')
      .select('id, name, type, file_type, file_size, created_at')
      .eq('organization_id', ctx.organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[operations/documents] list failed:', error)
      return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 })
    }

    const documents = (data ?? []).map(doc => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      file_size: doc.file_size,
      size_bytes: doc.file_size,
      created_at: doc.created_at,
    }))

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('[operations/documents] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load documents' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await extractTenantContext()
    if (!ctx?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = (await request.json()) as { id?: string }
    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    const db = createServiceClient()
    const { error } = await db
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)

    if (error) {
      console.error('[operations/documents] delete failed:', error)
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[operations/documents] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete document' },
      { status: 500 }
    )
  }
}
