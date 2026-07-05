import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('[Models] Error fetching models:', error)
      return NextResponse.json(
        { error: 'Failed to fetch models' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, models: data })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { name, description, type } = await request.json()
    
    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('ai_models')
      .insert({
        organization_id: organizationId,
        name,
        description,
        type,
        status: 'created',
        version: '1.0.0'
      })
      .select()
      .single()
    
    if (error) {
      console.error('[Models] Error creating model:', error)
      return NextResponse.json(
        { error: 'Failed to create model' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, model: data })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}