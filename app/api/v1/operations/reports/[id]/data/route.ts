
import { NextResponse, type NextRequest } from 'next/server'
import { withAuth, type AuthContext } from '@/lib/auth/with-auth'
import { createServiceClient } from '@/lib/supabase/service'

type AuthHandler = Parameters<typeof withAuth>[0]

async function handler(
  request: NextRequest,
  context: AuthContext & { params: { id: string } }
) {
  const { params, organizationId } = context;
  
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }
  
  try {
    const reportId = params.id
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const filters = searchParams.get('filters')
    
    const supabase = await createServiceClient()
    
    // Get report data
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
      return NextResponse.json({ error: 'Failed to fetch report data' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('[ReportData] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch report data' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(handler as AuthHandler);