
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
    const { format = 'json' } = await request.json()
    
    const supabase = await createServiceClient()
    
    // Generate report
    const { data, error } = await supabase
      .rpc('generate_report', {
        report_id: reportId,
        org_id: organizationId,
        format
      })
    
    if (error) {
      console.error('[ReportGenerate] Error generating report:', error)
      return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      report: data
    })
  } catch (error) {
    console.error('[ReportGenerate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handler as AuthHandler);