import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('datasets')
      .select('id, name, description, created_at, updated_at, size')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('[Datasets] Error fetching datasets:', error)
      return NextResponse.json(
        { error: 'Failed to fetch datasets' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, datasets: data })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { name, description } = await request.json()
    
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('datasets')
      .insert({
        organization_id: organizationId,
        name,
        description,
        size: 0
      })
      .select()
      .single()
    
    if (error) {
      console.error('[Datasets] Error creating dataset:', error)
      return NextResponse.json(
        { error: 'Failed to create dataset' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, dataset: data })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}