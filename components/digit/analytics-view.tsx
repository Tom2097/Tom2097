'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
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
  Sparkles,
  FileText,
  Loader2,
  Play,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
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

      {/* AI Analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AiQueryPanel />
        <SavedReportsPanel />
      </div>
    </div>
  )
}

interface AiQueryResult {
  explanation: string
  result: {
    type: 'timeseries' | 'breakdown' | 'summary'
    points?: Array<{ bucket: string; value: number }>
    rows?: Array<{ label: string; value: number }>
    summary?: { total_events: number; unique_users: number; distinct_events: number; total_value: number }
  }
}

function AiQueryPanel() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AiQueryResult | null>(null)

  const handleAsk = async () => {
    if (!question.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/v1/analytics/ai-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to run AI query')
        return
      }
      setResult(data.data)
    } catch {
      toast.error('Failed to run AI query')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Ask AI about your data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder="e.g. Show me daily active users for the last 30 days"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleAsk()
            }
          }}
          rows={2}
          className="resize-none text-sm"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAsk} disabled={loading || !question.trim()}>
            {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            Ask
          </Button>
        </div>

        {result && (
          <div className="rounded-xl border border-border/50 bg-secondary/30 p-4 space-y-3">
            <p className="text-xs text-muted-foreground">{result.explanation}</p>

            {result.result.type === 'summary' && result.result.summary && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Total events: </span>
                  <span className="font-medium text-foreground">{result.result.summary.total_events.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Unique users: </span>
                  <span className="font-medium text-foreground">{result.result.summary.unique_users.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Event types: </span>
                  <span className="font-medium text-foreground">{result.result.summary.distinct_events.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total value: </span>
                  <span className="font-medium text-foreground">{result.result.summary.total_value.toLocaleString()}</span>
                </div>
              </div>
            )}

            {result.result.type === 'timeseries' && result.result.points && (
              result.result.points.length > 0 ? (
                <LiveChart data={result.result.points.map((p) => ({ name: p.bucket, value: p.value }))} dataKey="value" type="area" currency={false} height={180} />
              ) : (
                <p className="text-xs text-muted-foreground">No data points for this range.</p>
              )
            )}

            {result.result.type === 'breakdown' && result.result.rows && (
              result.result.rows.length > 0 ? (
                <ul className="space-y-1">
                  {result.result.rows.slice(0, 10).map((row, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{row.label}</span>
                      <span className="font-medium text-muted-foreground">{row.value.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No rows for this breakdown.</p>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface SavedReport {
  id: string
  name: string
  description: string | null
  config: { type: string; event_name?: string | null; range_days?: number }
}

function SavedReportsPanel() {
  const [reports, setReports] = useState<SavedReport[]>([])
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [runOutput, setRunOutput] = useState<Record<string, unknown> | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', event_name: '', type: 'summary', range_days: '30' })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetch('/api/v1/analytics/reports')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setReports(data.data.reports)
      })
      .catch(() => {
        // Non-fatal: the panel just shows an empty state.
      })
      .finally(() => setLoading(false))
  }, [refreshKey])

  const handleRun = async (reportId: string) => {
    setRunningId(reportId)
    setRunOutput(null)
    try {
      const res = await fetch(`/api/v1/analytics/reports/${reportId}/run`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to run report')
        return
      }
      setRunOutput(data)
      toast.success('Report executed')
    } catch {
      toast.error('Failed to run report')
    } finally {
      setRunningId(null)
    }
  }

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/v1/analytics/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          config: {
            type: form.type,
            event_name: form.event_name || null,
            range_days: Number(form.range_days) || 30,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to create report')
        return
      }
      toast.success('Report created')
      setCreateOpen(false)
      setForm({ name: '', event_name: '', type: 'summary', range_days: '30' })
      setRefreshKey((k) => k + 1)
    } catch {
      toast.error('Failed to create report')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" />
          Saved Reports
        </CardTitle>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Saved Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Report name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                placeholder="Event name (optional)"
                value={form.event_name}
                onChange={(e) => setForm((f) => ({ ...f, event_name: e.target.value }))}
              />
              <Input
                placeholder="Range (days)"
                type="number"
                value={form.range_days}
                onChange={(e) => setForm((f) => ({ ...f, range_days: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading reports...</p>
        ) : reports.length === 0 ? (
          <p className="text-xs text-muted-foreground">No saved reports yet. Create one to get started.</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((report) => (
              <li
                key={report.id}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/30 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{report.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.config.type}
                    {report.config.event_name ? ` · ${report.config.event_name}` : ''}
                    {report.config.range_days ? ` · ${report.config.range_days}d` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRun(report.id)}
                  disabled={runningId === report.id}
                >
                  {runningId === report.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {runOutput ? (
          <pre className="max-h-40 overflow-auto rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
            {JSON.stringify(runOutput, null, 2)}
          </pre>
        ) : null}
      </CardContent>
    </Card>
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
