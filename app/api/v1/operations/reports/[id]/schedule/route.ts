
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
    const { frequency, recipients } = await request.json()
    
    if (!frequency || !recipients) {
      return NextResponse.json(
        { error: 'Frequency and recipients are required' },
        { status: 400 }
      )
    }
    
    const supabase = await createServiceClient()
    
    // Schedule report
    const { data, error } = await supabase
      .from('report_schedules')
      .upsert({
        report_id: reportId,
        organization_id: organizationId,
        frequency,
        recipients,
        is_active: true
      })
      .select()
      .single()
    
    if (error) {
      console.error('[ReportSchedule] Error scheduling report:', error)
      return NextResponse.json({ error: 'Failed to schedule report' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      schedule: data
    })
  } catch (error) {
    console.error('[ReportSchedule] Error:', error)
    return NextResponse.json(
      { error: 'Failed to schedule report' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handler as AuthHandler);