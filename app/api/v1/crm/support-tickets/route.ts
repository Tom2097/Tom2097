import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, subject, description, status, priority, category, contact_id, company_id, assigned_to, created_by, created_at, updated_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[SupportTickets] Error fetching tickets:', error)
      return NextResponse.json({ error: 'Failed to fetch support tickets' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { subject, description, status, priority, category, contact_id, company_id, assigned_to } = await request.json()

    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        organization_id: organizationId,
        subject,
        description: description || '',
        status: status || 'open',
        priority: priority || 'medium',
        category: category || null,
        contact_id: contact_id || null,
        company_id: company_id || null,
        assigned_to: assigned_to || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('[SupportTickets] Error creating ticket:', error)
      return NextResponse.json({ error: 'Failed to create support ticket' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
