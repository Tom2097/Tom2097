import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const reportId = params.id
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const filters = searchParams.get('filters')

    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .rpc('get_report_data', {
        report_id: reportId,
        org_id: organizationId,
        start_date: startDate,
        end_date: endDate,
        filters: filters ? JSON.parse(filters) : null
      })
    
    if (error) {
      console.error('[ReportData] Error fetching report data:', error)
      return NextResponse.json(
        { error: 'Failed to fetch report data' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}