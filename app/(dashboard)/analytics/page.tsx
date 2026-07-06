import { redirect } from 'next/navigation'
import { extractTenantContext } from '@/lib/multitenant/context'
import { querySummary, queryTimeseries, queryBreakdown } from '@/lib/analytics/engine'
import { getSystemHealth } from '@/lib/monitoring/engine'
import { getAuditLogStats } from '@/lib/audit/store'
import { detectAnomalies } from '@/lib/analytics/anomaly-detection'
import { forecastMetric } from '@/lib/analytics/forecasting'
import { AnalyticsView, type AnalyticsViewData } from '@/components/digit/analytics-view'

// Always render with fresh tenant data.
export const dynamic = 'force-dynamic'

const ALLOWED_DAYS = [7, 30, 90, 365]

function formatBucket(iso: string, days: number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (days <= 7) {
    return d.toLocaleDateString(undefined, { weekday: 'short' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const ctx = await extractTenantContext()
  if (!ctx) redirect('/auth/login')

  const orgId = ctx.organizationId
  const sp = await searchParams
  const requested = Number(sp.days)
  const days = ALLOWED_DAYS.includes(requested) ? requested : 30
  const granularity = days <= 7 ? 'day' : days <= 90 ? 'day' : 'week'

  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  const startIso = start.toISOString()
  const endIso = end.toISOString()

  // Fetch all live sources in parallel. Each is tenant-scoped by orgId.
  const [summary, timeseries, categories, topEvents, health, auditStats, anomalies, forecast] = await Promise.all([
    querySummary(orgId, startIso, endIso),
    queryTimeseries(orgId, {
      type: 'timeseries',
      event_name: 'session_start',
      event_category: 'user',
      start: startIso,
      end: endIso,
      granularity,
      aggregate: 'count',
      limit: 1000,
    }),
    queryBreakdown(orgId, {
      type: 'breakdown',
      event_name: 'session_start',
      event_category: 'user',
      dimension: 'event_category',
      start: startIso,
      end: endIso,
      aggregate: 'count',
      limit: 10,
      granularity: 'day',
    }),
    queryBreakdown(orgId, {
      type: 'breakdown',
      event_name: 'session_start',
      event_category: 'user',
      dimension: 'event_name',
      start: startIso,
      end: endIso,
      aggregate: 'count',
      limit: 10,
      granularity: 'day',
    }),
    getSystemHealth(orgId),
    getAuditLogStats(orgId, days).catch(() => null),
    detectAnomalies(orgId, 'session_start', { start: startIso, end: endIso }),
    forecastMetric(orgId, 'session_start', 6),
  ])

  // Build an aligned activity-vs-audit operational series keyed by date.
  const auditByDay = new Map<string, number>()
  for (const row of auditStats?.by_day ?? []) {
    auditByDay.set(new Date(row.date).toDateString(), row.count)
  }
  const operational = timeseries.map((p) => {
    const key = new Date(p.bucket).toDateString()
    return {
      name: formatBucket(p.bucket, days),
      activity: p.value,
      audit: auditByDay.get(key) ?? 0,
    }
  })

  const uptimePct =
    health.monitors.total > 0
      ? Math.round((health.monitors.up / health.monitors.total) * 1000) / 10
      : 100

  const data: AnalyticsViewData = {
    days,
    summary,
    activityTrend: timeseries.map((p) => ({ name: formatBucket(p.bucket, days), value: p.value })),
    categories: categories.map((r) => ({ name: r.label, value: r.value })),
    topEvents: topEvents.map((r) => ({ name: r.label, value: r.value })),
    operational,
    health,
    auditTotal: auditStats?.total ?? 0,
    uptimePct,
    anomalies: anomalies?.anomalies?.map(a => ({
      timestamp: a.timestamp,
      value: a.value,
      severity: typeof a.severity === 'string' ? parseFloat(a.severity) : a.severity
    })),
    forecast: forecast.map(f => ({
      timestamp: f.timestamp,
      actual: f.actual ?? 0, // Provide default for null actuals
      forecast: f.forecast,
      lower_bound: f.lower_bound,
      upper_bound: f.upper_bound,
    })),
    anomalySummary: anomalies.summary,
  }

  return <AnalyticsView {...data} />
}
