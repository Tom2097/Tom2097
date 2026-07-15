import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { id } = await params

    const { subject, description, status, priority, category, contact_id, company_id, assigned_to } = await request.json()

    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('support_tickets')
      .update({ subject, description, status, priority, category, contact_id, company_id, assigned_to })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single()

    if (error) {
      console.error('[SupportTickets] Error updating ticket:', error)
      return NextResponse.json({ error: 'Failed to update support ticket' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { id } = await params

    const supabase = await createServiceClient()
    const { error } = await supabase
      .from('support_tickets')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId)

    if (error) {
      console.error('[SupportTickets] Error deleting ticket:', error)
      return NextResponse.json({ error: 'Failed to delete support ticket' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
