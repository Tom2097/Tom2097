'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useI18n } from '@/components/providers/i18n-provider'
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Target,
  Lightbulb,
  RefreshCw,
  Activity,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ChartContainer, LiveChart, MultiLineChart } from '@/components/digit/live-chart'

export interface AnalyticsViewData {
  days: number
  summary: { total_events: number; unique_users: number; distinct_events: number; total_value: number }
  activityTrend: Array<{ name: string; value: number }>
  categories: Array<{ name: string; value: number }>
  topEvents: Array<{ name: string; value: number }>
  operational: Array<{ name: string; activity: number; audit: number }>
  health: {
    overall: string
    monitors: { total: number; up: number; down: number; degraded: number; unknown: number }
    open_incidents: number
  }
  auditTotal: number
  uptimePct: number
  anomalies?: Array<{ timestamp: string; value: number; severity: number }>
  forecast?: Array<{
    timestamp: string
    actual: number
    forecast: number
    lower_bound: number
    upper_bound: number
  }>
  anomalySummary?: {
    total: number
    byMethod?: Record<string, number>
    bySeverity?: Record<string, number>
    byType?: Record<string, number>
  }
}

const PERIODS: Array<{ value: string; days: number }> = [
  { value: '7d', days: 7 },
  { value: '30d', days: 30 },
  { value: '90d', days: 90 },
  { value: '1y', days: 365 },
]

function pctChange(series: Array<{ value: number }>): number {
  if (series.length < 2) return 0
  const mid = Math.floor(series.length / 2)
  const first = series.slice(0, mid).reduce((s, p) => s + p.value, 0)
  const second = series.slice(mid).reduce((s, p) => s + p.value, 0)
  if (first === 0) return second > 0 ? 100 : 0
  return Math.round(((second - first) / first) * 1000) / 10
}

export function AnalyticsView(data: AnalyticsViewData) {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const currentPeriod = PERIODS.find((p) => p.days === data.days)?.value ?? '30d'
  const activityChange = pctChange(data.activityTrend)

  const handlePeriod = (value: string) => {
    const period = PERIODS.find((p) => p.value === value)
    if (!period) return
    startTransition(() => {
      router.push(`${pathname}?days=${period.days}`)
    })
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    startTransition(() => {
      router.refresh()
      setTimeout(() => setIsRefreshing(false), 600)
    })
  }

  // AI insights derived entirely from live signals
  const insights: Array<{ type: 'opportunity' | 'warning' | 'insight'; title: string; description: string; impact: string }> = []
  if (data.health.open_incidents > 0) {
    insights.push({
      type: 'warning',
      title: t("analytics.page.openIncidentsDetected"),
      description: t("analytics.page.unresolvedIncidents", {
        count: data.health.open_incidents,
        plural: data.health.open_incidents > 1 ? 's' : '',
        total: data.health.monitors.total,
        servicesPlural: data.health.monitors.total === 1 ? '' : 's'
      }),
      impact: 'Needs attention',
    })
  }
  if (data.health.monitors.down > 0 || data.health.monitors.degraded > 0) {
    insights.push({
      type: 'warning',
      title: 'Service Health Alert',
      description: t("analytics.page.servicesDown", {
        down: data.health.monitors.down,
        degraded: data.health.monitors.degraded,
        uptime: data.uptimePct
      }),
      impact: 'High priority',
    })
  }
  if (data.categories.length > 0) {
    const top = data.categories[0]
    insights.push({
      type: 'insight',
      title: 'Most Active Category',
      description: t("analytics.page.topEvent", {
        name: top.name,
        value: top.value.toLocaleString(),
        days: data.days
      }),
      impact: `${Math.round((top.value / Math.max(data.summary.total_events, 1)) * 100)}% of volume`,
    })
  }
  if (data.activityTrend.length >= 2) {
    insights.push({
      type: activityChange >= 0 ? 'opportunity' : 'insight',
      title: activityChange >= 0 ? t("analytics.page.activityTrendingUp") : t("analytics.page.activitySlowing"),
      description: t("analytics.page.activityChange", {
        direction: activityChange >= 0 ? t("analytics.page.opportunity").toLowerCase() : t("analytics.page.insight").toLowerCase(),
        change: Math.abs(activityChange)
      }),
      impact: t("analytics.page.impact", { change: `${activityChange >= 0 ? '+' : ''}${activityChange}` }),
    })
  }
  if (insights.length === 0) {
    insights.push({
      type: 'insight',
      title: 'All Systems Nominal',
      description: t("analytics.page.steadyActivity"),
      impact: 'Healthy',
    })
  }

  // Live KPI rows sourced from real systems
  const kpis: Array<{ metric: string; value: string; source: string }> = [
    { metric: t("analytics.page.totalEvents"), value: data.summary.total_events.toLocaleString(), source: t("analytics.page.sourceAnalytics") },
    { metric: t("analytics.page.activeUsers"), value: data.summary.unique_users.toLocaleString(), source: t("analytics.page.sourceAnalytics") },
    { metric: t("analytics.page.eventTypes"), value: data.summary.distinct_events.toLocaleString(), source: t("analytics.page.sourceAnalytics") },
    { metric: t("analytics.page.serviceUptime"), value: `${data.uptimePct}%`, source: t("analytics.page.sourceMonitoring") },
    { metric: t("analytics.page.openIncidents"), value: data.health.open_incidents.toLocaleString(), source: t("analytics.page.sourceMonitoring") },
    { metric: t("analytics.page.auditEvents"), value: data.auditTotal.toLocaleString(), source: t("analytics.page.sourceAuditLog") },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("analytics.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("analytics.page.subtitle")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={currentPeriod} onValueChange={handlePeriod} className="hidden sm:block">
            <TabsList>
              {PERIODS.map((p) => (
                <TabsTrigger key={p.value} value={p.value}>
                  {p.value.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing || isPending}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing || isPending ? 'animate-spin' : ''}`} />
            <span className="sr-only">{t("analytics.page.refreshData")}</span>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <MetricGrid columns={4}>
        <MetricCard
          label={t("analytics.page.totalEvents")}
          value={data.summary.total_events.toLocaleString()}
          change={activityChange}
          trend={activityChange > 0 ? 'up' : activityChange < 0 ? 'down' : 'stable'}
          variant="highlight"
          subtitle={`Last ${data.days} days`}
        />
        <MetricCard
          label={t("analytics.page.activeUsers")}
          value={data.summary.unique_users.toLocaleString()}
          subtitle={`${data.summary.distinct_events} event types`}
          trend="stable"
        />
        <MetricCard
          label={t("analytics.page.serviceUptime")}
          value={`${data.uptimePct}%`}
          subtitle={`${data.health.monitors.up}/${data.health.monitors.total} services up`}
          trend={data.uptimePct >= 99 ? 'up' : data.uptimePct >= 90 ? 'stable' : 'down'}
        />
        <MetricCard
          label={t("analytics.page.openIncidents")}
          value={data.health.open_incidents}
          subtitle={data.health.open_incidents === 0 ? t("analytics.page.allClear") : t("analytics.page.needsAttention")}
          trend={data.health.open_incidents === 0 ? 'down' : 'up'}
        />
      </MetricGrid>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer title={t("analytics.page.platformActivityTrend")} subtitle={t("analytics.page.eventVolume")}>
          {data.activityTrend.length > 0 ? (
            <LiveChart data={data.activityTrend} dataKey="value" type="area" currency={false} />
          ) : (
            <EmptyState icon={Activity} label={t("analytics.page.noActivity")} />
          )}
        </ChartContainer>

        <ChartContainer title={t("analytics.page.activityByCategory")} subtitle={t("analytics.page.eventDistribution")}>
          {data.categories.length > 0 ? (
            <LiveChart
              data={data.categories}
              dataKey="value"
              type="bar"
              height={300}
              color="#a78bfa"
              currency={false}
            />
          ) : (
            <EmptyState icon={BarChart3} label={t("analytics.page.noCategorizedEvents")} />
          )}
        </ChartContainer>
      </div>

      {/* Operational Insights */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartContainer
          title={t("analytics.page.operationalActivity")}
          subtitle={t("analytics.page.platformVsAudit")}
          className="lg:col-span-2"
        >
          {data.operational.length > 0 ? (
            <MultiLineChart
              data={data.operational}
              lines={[
                { dataKey: 'activity', color: '#22d3ee', name: t("analytics.page.platformEvents") },
                { dataKey: 'audit', color: '#f59e0b', name: t("analytics.page.auditEventsSeries") },
              ]}
              height={280}
            />
          ) : (
            <EmptyState icon={Activity} label={t("analytics.page.noOperationalActivity")} />
          )}
        </ChartContainer>

        {/* AI Insights Panel */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Live Insights</h3>
          </div>

          <div className="space-y-4">
            {insights.map((insight, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/50 bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"
              >
                <div className="mb-2 flex items-center gap-2">
                  {insight.type === 'opportunity' && <TrendingUp className="h-4 w-4 text-emerald-500" />}
                  {insight.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  {insight.type === 'insight' && <Target className="h-4 w-4 text-primary" />}
                  <span className="text-sm font-medium text-foreground">{insight.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{insight.description}</p>
                <div className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {insight.impact}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live KPIs Table */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Platform KPIs</h3>
              <p className="text-sm text-muted-foreground">Current values across connected systems</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Metric</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Current Value</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Source System</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {kpis.map((row, i) => (
                <tr key={i} className="hover:bg-secondary/30">
                  <td className="py-3 text-sm font-medium text-foreground">{row.metric}</td>
                  <td className="py-3 text-sm text-foreground">{row.value}</td>
                  <td className="py-3">
                    <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {row.source}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, label }: { icon: typeof Activity; label: string }) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-muted-foreground">
      <Icon className="h-8 w-8 opacity-40" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
