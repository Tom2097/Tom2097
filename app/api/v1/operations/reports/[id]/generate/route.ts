import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const reportId = params.id
    const { format = 'json' } = await request.json()
    
    const supabase = await createServiceClient()
    
    const { data, error } = await supabase
      .rpc('generate_report', {
        report_id: reportId,
        org_id: organizationId,
        format
      })
    
    if (error) {
      console.error('[ReportGenerate] Error generating report:', error)
      return NextResponse.json(
        { error: 'Failed to generate report' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      report: data
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}