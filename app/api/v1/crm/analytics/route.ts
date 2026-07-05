import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || 'quarter'
    const ownerId = searchParams.get('ownerId') || null
    const stage = searchParams.get('stage') || null

    const supabase = await createServiceClient()

    // Get pipeline analytics
    const { data: pipelineData, error: pipelineError } = await supabase
      .rpc('get_pipeline_analytics', {
        org_id: organizationId,
        time_range: timeRange,
        owner_id: ownerId,
        stage_filter: stage
      })

    if (pipelineError) {
      console.error('[CRMAnalytics] Error fetching pipeline analytics:', pipelineError)
      return NextResponse.json(
        { error: 'Failed to fetch pipeline analytics' },
        { status: 500 }
      )
    }

    // Get revenue analytics
    const { data: revenueData, error: revenueError } = await supabase
      .rpc('get_revenue_analytics', {
        org_id: organizationId,
        time_range: timeRange,
        owner_id: ownerId
      })

    if (revenueError) {
      console.error('[CRMAnalytics] Error fetching revenue analytics:', revenueError)
      return NextResponse.json(
        { error: 'Failed to fetch revenue analytics' },
        { status: 500 }
      )
    }

    // Get activity analytics
    const { data: activityData, error: activityError } = await supabase
      .rpc('get_activity_analytics', {
        org_id: organizationId,
        time_range: timeRange,
        owner_id: ownerId
      })

    if (activityError) {
      console.error('[CRMAnalytics] Error fetching activity analytics:', activityError)
      return NextResponse.json(
        { error: 'Failed to fetch activity analytics' },
        { status: 500 }
      )
    }

    // Get conversion analytics
    const { data: conversionData, error: conversionError } = await supabase
      .rpc('get_conversion_analytics', {
        org_id: organizationId,
        time_range: timeRange,
        owner_id: ownerId
      })

    if (conversionError) {
      console.error('[CRMAnalytics] Error fetching conversion analytics:', conversionError)
      return NextResponse.json(
        { error: 'Failed to fetch conversion analytics' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      pipeline: pipelineData,
      revenue: revenueData,
      activity: activityData,
      conversion: conversionData
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}