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
    const { frequency, recipients } = await request.json()
    
    if (!frequency || !recipients) {
      return NextResponse.json(
        { error: 'Frequency and recipients are required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()
    
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
      return NextResponse.json(
        { error: 'Failed to schedule report' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      schedule: data
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}