import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

function toReportShape(row: Record<string, unknown>) {
  const config = (row.config as Record<string, unknown>) ?? {}
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    status: row.status,
    schedule: row.schedule ?? undefined,
    created_at: row.created_at,
    last_generated: row.last_generated ?? undefined,
    data_source: config.data_source ?? 'documents',
    filters: config.filters ?? {},
    visualization_type: config.visualization_type ?? 'table',
  }
}

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from('operational_reports')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Reports] Error fetching reports:', error)
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, reports: (data ?? []).map(toReportShape) })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { name, description, type, config } = await request.json()
    
    if (!name || !type || !config) {
      return NextResponse.json(
        { error: 'Name, type, and config are required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .from('operational_reports')
      .insert({
        organization_id: organizationId,
        name,
        description,
        type,
        config
      })
      .select()
      .single()
    
    if (error) {
      console.error('[Reports] Error creating report:', error)
      return NextResponse.json(
        { error: 'Failed to create report' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, report: toReportShape(data) })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}