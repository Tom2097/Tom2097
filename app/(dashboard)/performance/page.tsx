import { Activity, BarChart3, TrendingUp, Target, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { extractTenantContext } from "@/lib/multitenant/context"
import { listObjectives, computePacing } from "@/lib/analytics/okr"
import { getCohortBenchmarks } from "@/lib/analytics/cohorts"
import { driverDecomposition, forecastMetric } from "@/lib/analytics/forecasting"

export default async function PerformancePage() {
  const ctx = await extractTenantContext()
  const orgId = ctx?.organizationId

  const [objectives, benchmarks, drivers, forecast] = orgId
    ? await Promise.all([
        listObjectives(orgId).catch(() => []),
        getCohortBenchmarks(orgId, "revenue").catch(() => []),
        driverDecomposition(orgId).catch(() => []),
        forecastMetric(orgId, "revenue", 6).catch(() => []),
      ])
    : [[], [], [], []]

  const activeObjectives = objectives.filter((o) => o.status === "active")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Performance Workspace</h1>
            <p className="text-sm text-muted-foreground">OKRs, KPIs, forecasting, anomaly detection, and benchmarking</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Target className="h-4 w-4 mr-2" />New Objective</Button>
          <Button><BarChart3 className="h-4 w-4 mr-2" />Run Report</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <p className="text-sm text-muted-foreground">Active OKRs</p>
          <p className="text-3xl font-bold text-foreground">{activeObjectives.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{objectives.length} total objectives</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <p className="text-sm text-muted-foreground">Benchmark Percentile</p>
          <p className="text-3xl font-bold text-foreground">{benchmarks.length > 0 ? `${benchmarks[0].percentile ?? 50}th` : "N/A"}</p>
          <p className="text-xs text-muted-foreground mt-1">vs. {benchmarks[0]?.cohort ?? "industry"}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <p className="text-sm text-muted-foreground">Key Drivers</p>
          <p className="text-3xl font-bold text-foreground">{drivers.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Decomposition factors</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <p className="text-sm text-muted-foreground">Forecast Periods</p>
          <p className="text-3xl font-bold text-foreground">{forecast.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Projected data points</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
            <Target className="h-5 w-5 text-amber-500" />Active Objectives
          </h3>
          {activeObjectives.length > 0 ? (
            <div className="space-y-3">
              {activeObjectives.slice(0, 8).map((obj, i) => (
                <div key={i} className="rounded-xl bg-secondary/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{obj.title}</p>
                    <span className="text-xs text-muted-foreground capitalize">{obj.owner}</span>
                  </div>
                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(obj.progress ?? 0, 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{obj.progress ?? 0}% complete</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No active objectives</div>
          )}
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
            <TrendingUp className="h-5 w-5 text-green-500" />Driver Decomposition
          </h3>
          {drivers.length > 0 ? (
            <div className="space-y-3">
              {drivers.map((d, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-secondary/30 p-3">
                  <span className="text-sm font-medium capitalize">{d.driver.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${d.direction === "up" ? "bg-green-500" : "bg-red-500"}`}
                        style={{ width: `${Math.abs(d.contribution) * 100}%` }} />
                    </div>
                    <span className={`text-xs font-medium ${d.direction === "up" ? "text-green-500" : "text-red-500"}`}>
                      {d.direction === "up" ? "+" : ""}{(d.contribution * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">No driver data available</div>
          )}
        </div>
      </div>
    </div>
  )
}
