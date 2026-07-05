import { LayoutGrid, Activity, FileText, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ChartContainer, LiveChart } from '@/components/digit/live-chart'
import { extractTenantContext } from '@/lib/multitenant/context'
import { getSystemHealth, listMonitors } from '@/lib/monitoring/engine'
import { getOperationalMetrics } from '@/lib/dashboard/queries'

const STATUS_STYLES: Record<string, string> = {
  up: 'bg-emerald-500/20 text-emerald-500',
  degraded: 'bg-amber-500/20 text-amber-500',
  down: 'bg-red-500/20 text-red-500',
  unknown: 'bg-muted text-muted-foreground',
}

/**
 * Generic operational workspace used by configurable modules
 * (operations / performance / resources / compliance).
 *
 * DigiT is an industry-agnostic platform — this view presents neutral
 * operational intelligence sourced from the tenant's live monitoring and
 * analytics tables rather than any vertical-specific or fabricated data.
 */
export async function GenericWorkspace({ title = 'Operations Workspace' }: { title?: string }) {
  const ctx = await extractTenantContext()
  const orgId = ctx?.organizationId

  const [health, monitorsResult, operational] = orgId
    ? await Promise.all([
        getSystemHealth(orgId).catch(() => null),
        listMonitors(orgId, { limit: 6 }).catch(() => ({ monitors: [], total: 0 })),
        getOperationalMetrics(orgId),
      ])
    : [null, { monitors: [], total: 0 }, []]

  const monitors = monitorsResult.monitors
  const uptimePct =
    health && health.monitors.total > 0
      ? Math.round((health.monitors.up / health.monitors.total) * 1000) / 10
      : 100
  const latencyValues = monitors
    .map((m) => m.last_latency_ms)
    .filter((v): v is number => typeof v === 'number')
  const avgLatency =
    latencyValues.length > 0
      ? Math.round(latencyValues.reduce((sum, v) => sum + v, 0) / latencyValues.length)
      : null
  const throughputData = operational.map((d) => ({ name: d.name, value: d.value }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">
              Configurable operational intelligence for your organization
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.location.href = "/analytics/reports"}>
            <FileText className="h-4 w-4" />
            View Reports
          </Button>
          <Button className="gap-2" onClick={() => window.location.href = "/analytics/configure"}>
            <Workflow className="h-4 w-4" />
            Configure Workspace
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <MetricGrid columns={4}>
        <MetricCard
          label="Active Monitors"
          value={health?.monitors.total ?? 0}
          subtitle="Enabled checks"
          variant="highlight"
        />
        <MetricCard label="Uptime" value={`${uptimePct}%`} subtitle="Monitors reporting healthy" />
        <MetricCard label="Open Incidents" value={health?.open_incidents ?? 0} subtitle="Unresolved" />
        <MetricCard label="Avg. Latency" value={avgLatency != null ? `${avgLatency}ms` : '—'} />
      </MetricGrid>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer title="Throughput" subtitle="Operational throughput series">
          {throughputData.length > 0 ? (
            <LiveChart data={throughputData} dataKey="value" type="line" color="hsl(var(--primary))" />
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              No throughput data recorded yet.
            </div>
          )}
        </ChartContainer>

        <ChartContainer title="System Performance" subtitle="Operational performance metrics">
          {operational.length > 0 ? (
            <LiveChart data={operational} dataKey="cpu" type="area" />
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              No performance data recorded yet.
            </div>
          )}
        </ChartContainer>
      </div>

      {/* Monitored streams */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Monitored Streams</h3>
        </div>
        {monitors.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {monitors.map((monitor) => {
              const status = monitor.last_status ?? 'unknown'
              return (
                <div key={monitor.id} className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
                  <div>
                    <p className="font-medium text-foreground">{monitor.name}</p>
                    <p className="text-xs text-muted-foreground">{monitor.description || monitor.target}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      STATUS_STYLES[status] ?? STATUS_STYLES.unknown
                    }`}
                  >
                    {status}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-10 text-center">
            <p className="font-medium text-foreground">No monitored streams yet</p>
            <p className="text-sm text-muted-foreground">
              Configure monitors to track operational health in this workspace.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
