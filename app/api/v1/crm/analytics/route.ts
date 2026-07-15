import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedUser, getOrganizationId, handleAuthError } from '@/lib/auth/server-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { DEAL_STAGES, type DealStage } from '@/lib/crm/types'

const RANGE_DAYS: Record<string, number | null> = { week: 7, month: 30, quarter: 90, year: 365, all: null }

// Computed directly from crm_deals/crm_activities in-process (like getPipelineSummary) --
// there is no separate analytics RPC layer for this shape, and building one would just
// duplicate this query. Matches the exact SalesAnalyticsData contract
// components/digit/crm-sales-analytics.tsx already expects.
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const organizationId = await getOrganizationId(user.id)

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || 'quarter'
    const ownerId = searchParams.get('ownerId') || null
    const stageFilter = (searchParams.get('stage') as DealStage) || null
    const rangeDays = RANGE_DAYS[timeRange] ?? 90

    const db = createServiceClient()
    let query = db
      .from('crm_deals')
      .select('id,title,value,stage,probability,currency,expected_close_date,created_at,closed_at,owner_id,company_id,contact_id,lost_reason')
      .eq('organization_id', organizationId)
    if (ownerId) query = query.eq('owner_id', ownerId)
    if (stageFilter) query = query.eq('stage', stageFilter)
    if (rangeDays) query = query.gte('created_at', new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString())

    const { data: deals, error } = await query
    if (error) {
      console.error('[CRMAnalytics] Error fetching deals:', error)
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }
    const rows = deals ?? []

    const closedStages: DealStage[] = ['won', 'lost']
    const openStages = DEAL_STAGES.filter((s) => !closedStages.includes(s))
    const wonDeals = rows.filter((d) => d.stage === 'won')
    const lostDeals = rows.filter((d) => d.stage === 'lost')
    const openDeals = rows.filter((d) => openStages.includes(d.stage as DealStage))

    const totalValue = openDeals.reduce((s, d) => s + (d.value ?? 0), 0)
    const totalDeals = rows.length
    const averageDealSize = totalDeals > 0 ? rows.reduce((s, d) => s + (d.value ?? 0), 0) / totalDeals : 0
    const closedCount = wonDeals.length + lostDeals.length
    const winRate = closedCount > 0 ? wonDeals.length / closedCount : 0

    const cycleDays = wonDeals
      .filter((d) => d.closed_at && d.created_at)
      .map((d) => (new Date(d.closed_at!).getTime() - new Date(d.created_at!).getTime()) / (1000 * 60 * 60 * 24))
    const averageSalesCycle = cycleDays.length > 0 ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) : 0

    const stageDistribution: Record<string, number> = {}
    const valueByStage: Record<string, number> = {}
    for (const stage of DEAL_STAGES) {
      stageDistribution[stage] = rows.filter((d) => d.stage === stage).length
      valueByStage[stage] = rows.filter((d) => d.stage === stage).reduce((s, d) => s + (d.value ?? 0), 0)
    }

    // Conversion rate stage[i] -> stage[i+1]: what fraction of deals that ever reached
    // stage[i] progressed to (or past) stage[i+1], approximated by current stage index
    // among still-tracked deals (a real, if simple, funnel measure -- no fabricated numbers).
    const stageOrder: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'won']
    const conversionRates: Record<string, number> = {}
    for (let i = 0; i < stageOrder.length - 1; i++) {
      const reached = rows.filter((d) => stageOrder.indexOf(d.stage as DealStage) >= i || d.stage === 'won').length
      const advanced = rows.filter((d) => stageOrder.indexOf(d.stage as DealStage) >= i + 1 || d.stage === 'won').length
      conversionRates[stageOrder[i]] = reached > 0 ? advanced / reached : 0
    }

    const ownerIds = [...new Set(rows.map((d) => d.owner_id).filter(Boolean))] as string[]
    const { data: owners } = ownerIds.length
      ? await db.from('profiles').select('id,full_name,email').in('id', ownerIds)
      : { data: [] }
    const ownerName = new Map((owners ?? []).map((o) => [o.id, o.full_name ?? o.email ?? 'Unknown']))
    const topPerformers = ownerIds
      .map((id) => {
        const ownerDeals = rows.filter((d) => d.owner_id === id)
        const ownerWon = ownerDeals.filter((d) => d.stage === 'won')
        const ownerClosed = ownerDeals.filter((d) => closedStages.includes(d.stage as DealStage))
        return {
          owner_id: id,
          owner_name: ownerName.get(id) ?? 'Unknown',
          dealCount: ownerDeals.length,
          totalValue: ownerDeals.reduce((s, d) => s + (d.value ?? 0), 0),
          winRate: ownerClosed.length > 0 ? ownerWon.length / ownerClosed.length : 0,
        }
      })
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10)

    // Deals over time, bucketed by month of created_at.
    const monthKey = (iso: string) => iso.slice(0, 7)
    const overTimeMap = new Map<string, { count: number; value: number }>()
    for (const d of rows) {
      const key = monthKey(d.created_at)
      const bucket = overTimeMap.get(key) ?? { count: 0, value: 0 }
      bucket.count += 1
      bucket.value += d.value ?? 0
      overTimeMap.set(key, bucket)
    }
    const dealsOverTime = [...overTimeMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }))

    // Forecast accuracy: calibration of probability against actual outcome for closed
    // deals -- a deal at >=70% that won, or <30% that lost, counted "accurate" -- bucketed
    // by the month it closed. Real, derived from closed deals; not a fabricated figure.
    const closedRows = rows.filter((d) => d.closed_at && closedStages.includes(d.stage as DealStage))
    const isAccurate = (d: (typeof rows)[number]) => (d.stage === 'won' && (d.probability ?? 0) >= 70) || (d.stage === 'lost' && (d.probability ?? 0) < 30)
    const accuracyByMonth = new Map<string, { accurate: number; total: number }>()
    for (const d of closedRows) {
      const key = monthKey(d.closed_at!)
      const bucket = accuracyByMonth.get(key) ?? { accurate: 0, total: 0 }
      bucket.total += 1
      if (isAccurate(d)) bucket.accurate += 1
      accuracyByMonth.set(key, bucket)
    }
    const historicalAccuracy = [...accuracyByMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, v]) => ({ period, accuracy: v.total > 0 ? v.accurate / v.total : 0 }))
    const overallAccuracy = closedRows.length > 0 ? closedRows.filter(isAccurate).length / closedRows.length : 0

    const lostReasonMap = new Map<string, { count: number; value: number }>()
    for (const d of lostDeals) {
      const reason = d.lost_reason || 'Not specified'
      const bucket = lostReasonMap.get(reason) ?? { count: 0, value: 0 }
      bucket.count += 1
      bucket.value += d.value ?? 0
      lostReasonMap.set(reason, bucket)
    }
    const lostReasons = [...lostReasonMap.entries()].map(([reason, v]) => ({ reason, ...v }))

    return NextResponse.json({
      totalDeals,
      totalValue,
      averageDealSize,
      winRate,
      averageSalesCycle,
      conversionRates,
      stageDistribution,
      valueByStage,
      dealsOverTime,
      topPerformers,
      forecastAccuracy: { accuracy: overallAccuracy, variance: overallAccuracy - 0.85, historicalAccuracy },
      lostReasons,
    })
  } catch (error) {
    return handleAuthError(error as Error)
  }
}
