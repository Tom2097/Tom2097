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
      .select(`
        id, subject, status, priority, created_at, updated_at,
        contact:contact_id (id, full_name, email),
        assignee:assignee_id (id, full_name, email),
        created_by:created_by (id, full_name, email)
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('[SupportTickets] Error fetching tickets:', error)
      return NextResponse.json(
        { error: 'Failed to fetch support tickets' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, tickets: data })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { subject, description, priority, contactId, assigneeId } = await request.json()
    
    if (!subject || !description || !contactId) {
      return NextResponse.json(
        { error: 'Subject, description, and contact ID are required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        organization_id: organizationId,
        subject,
        description,
        priority: priority || 'medium',
        status: 'open',
        contact_id: contactId,
        assignee_id: assigneeId || null
      })
      .select()
      .single()
    
    if (error) {
      console.error('[SupportTickets] Error creating ticket:', error)
      return NextResponse.json(
        { error: 'Failed to create support ticket' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, ticket: data })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { id, status, priority, assigneeId } = await request.json()
    
    if (!id) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        status,
        priority,
        assignee_id: assigneeId
      })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single()
    
    if (error) {
      console.error('[SupportTickets] Error updating ticket:', error)
      return NextResponse.json(
        { error: 'Failed to update support ticket' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, ticket: data })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { id } = await request.json()
    
    if (!id) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    
    const { error } = await supabase
      .from('support_tickets')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId)
    
    if (error) {
      console.error('[SupportTickets] Error deleting ticket:', error)
      return NextResponse.json(
        { error: 'Failed to delete support ticket' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}