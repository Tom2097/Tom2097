import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractTenantContext } from '@/lib/multitenant/context.server'

export async function GET() {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
    }

    const supabase = createServiceClient()
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, name, type, file_size, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('[documents] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await extractTenantContext()
    const orgId = ctx?.organizationId

    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 403 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('organization_id', orgId)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[documents] Delete Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}