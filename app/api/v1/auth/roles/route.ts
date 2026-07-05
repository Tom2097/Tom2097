import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('roles')
      .select('id, name, description, permissions, is_system_role, created_at, updated_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('[Roles] Error fetching roles:', error)
      return NextResponse.json(
        { error: 'Failed to fetch roles' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, roles: data })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { name, description, permissions } = await request.json()
    
    if (!name || !permissions) {
      return NextResponse.json(
        { error: 'Name and permissions are required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('roles')
      .insert({
        organization_id: organizationId,
        name,
        description,
        permissions,
        is_system_role: false
      })
      .select()
      .single()
    
    if (error) {
      console.error('[Roles] Error creating role:', error)
      return NextResponse.json(
        { error: 'Failed to create role' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, role: data })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { id, name, description, permissions } = await request.json()
    
    if (!id || !name || !permissions) {
      return NextResponse.json(
        { error: 'ID, name, and permissions are required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('roles')
      .update({
        name,
        description,
        permissions
      })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single()
    
    if (error) {
      console.error('[Roles] Error updating role:', error)
      return NextResponse.json(
        { error: 'Failed to update role' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, role: data })
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
        { error: 'Role ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId)
    
    if (error) {
      console.error('[Roles] Error deleting role:', error)
      return NextResponse.json(
        { error: 'Failed to delete role' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}