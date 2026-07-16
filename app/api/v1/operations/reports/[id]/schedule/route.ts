import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { id: reportId } = await params

    const { frequency, recipients } = await request.json()

    if (!frequency || !recipients) {
      return NextResponse.json(
        { error: 'Frequency and recipients are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { data: report } = await supabase
      .from('operational_reports')
      .select('id')
      .eq('id', reportId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const nextRun = new Date()
    if (frequency === 'daily') nextRun.setDate(nextRun.getDate() + 1)
    else if (frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 7)
    else if (frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1)

    const { data: existing } = await supabase
      .from('report_schedules')
      .select('id')
      .eq('definition_id', reportId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    const scheduleRow = {
      definition_id: reportId,
      organization_id: organizationId,
      frequency,
      recipients,
      is_enabled: true,
      next_run_at: nextRun.toISOString(),
    }

    const { data, error } = existing
      ? await supabase.from('report_schedules').update(scheduleRow).eq('id', existing.id).select().single()
      : await supabase.from('report_schedules').insert(scheduleRow).select().single()

    if (error) {
      console.error('[ReportSchedule] Error scheduling report:', error)
      return NextResponse.json(
        { error: 'Failed to schedule report' },
        { status: 500 }
      )
    }

    await supabase
      .from('operational_reports')
      .update({ status: 'scheduled', schedule: { frequency, next_run: nextRun.toISOString() } })
      .eq('id', reportId)
      .eq('organization_id', organizationId)

    return NextResponse.json({
      success: true,
      schedule: data
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}