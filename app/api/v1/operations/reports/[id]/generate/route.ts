import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { computeReportData } from '@/lib/operational/reports'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)
    const { id: reportId } = await params

    const supabase = createServiceClient()

    const { data: report } = await supabase
      .from('operational_reports')
      .select('config')
      .eq('id', reportId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const dataSource = (report.config as Record<string, unknown> | null)?.data_source as string | undefined
    const reportData = await computeReportData(organizationId, dataSource ?? 'documents')

    const { error } = await supabase
      .from('operational_reports')
      .update({ status: 'generated', last_generated: new Date().toISOString() })
      .eq('id', reportId)
      .eq('organization_id', organizationId)

    if (error) {
      console.error('[ReportGenerate] Error generating report:', error)
      return NextResponse.json(
        { error: 'Failed to generate report' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: reportData,
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
