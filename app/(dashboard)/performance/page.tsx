import { redirect } from "next/navigation"
import { Activity, TrendingUp, Target, AlertTriangle } from "lucide-react"
import { extractTenantContext } from "@/lib/multitenant/context.server"
import { listObjectives, computePacing } from "@/lib/analytics/okr"
import { getCohortBenchmarks } from "@/lib/analytics/cohorts"
import { driverDecomposition, forecastMetric } from "@/lib/analytics/forecasting"
import { getTranslator } from "@/lib/i18n/server"
import { NewObjectiveDialog } from "@/components/digit/performance/new-objective-dialog"
import { RunReportButton } from "@/components/digit/performance/run-report-button"
import { KeyResultsPanel } from "@/components/digit/performance/key-results-panel"

export default async function PerformancePage() {
  const ctx = await extractTenantContext()
  if (!ctx) redirect("/auth/login")
  const { t } = await getTranslator()
  const orgId = ctx.organizationId

  const [objectives, benchmarks, drivers, forecast] = await Promise.all([
    listObjectives(orgId).catch(() => []),
    getCohortBenchmarks(orgId, "revenue").catch(() => []),
    driverDecomposition(orgId).catch(() => []),
    forecastMetric(orgId, "revenue", 6).catch(() => []),
  ])

  const activeObjectives = objectives.filter((o) => o.status !== "completed")

  // Pacing (expected vs. actual progress given elapsed time in the objective's
  // window) is computed per-objective so the Active Objectives list can show
  // whether progress -- now driven by real key-result values -- is on schedule.
  const pacingByObjective = new Map(
    await Promise.all(
      activeObjectives.slice(0, 8).map(async (o) => [o.id, await computePacing(orgId, o.id).catch(() => null)] as const),
    ),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("performance.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("performance.page.subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
           <NewObjectiveDialog label={t("performance.page.newObjective")} />
           <RunReportButton label={t("performance.page.runReport")} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border/50 bg-card p-6">
           <p className="text-sm text-muted-foreground">{t("performance.page.activeObjectives")}</p>
          <p className="text-3xl font-bold text-foreground">{activeObjectives.length}</p>
           <p className="text-xs text-muted-foreground mt-1">{objectives.length} {t("performance.page.totalObjectives")}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-6">
           <p className="text-sm text-muted-foreground">{t("performance.page.benchmarks")}</p>
          <p className="text-3xl font-bold text-foreground">{benchmarks.length > 0 ? `${benchmarks[0].percentile ?? 50}th` : "N/A"}</p>
           <p className="text-xs text-muted-foreground mt-1">{t("performance.page.vsCohort", { cohort: benchmarks[0]?.cohort ?? "industry" })}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-6">
           <p className="text-sm text-muted-foreground">{t("performance.page.keyDrivers")}</p>
          <p className="text-3xl font-bold text-foreground">{drivers.length}</p>
           <p className="text-xs text-muted-foreground mt-1">{t("performance.page.decompositionFactors")}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-6">
           <p className="text-sm text-muted-foreground">{t("performance.page.forecastPeriods")}</p>
          <p className="text-3xl font-bold text-foreground">{forecast.length}</p>
           <p className="text-xs text-muted-foreground mt-1">{t("performance.page.projectedDataPoints")}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-card p-6">
           <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
             <Target className="h-5 w-5 text-amber-500" />{t("performance.page.activeObjectives")}
           </h3>
          {activeObjectives.length > 0 ? (
            <div className="space-y-3">
              {activeObjectives.slice(0, 8).map((obj) => {
                const pacing = pacingByObjective.get(obj.id)
                return (
                  <div key={obj.id} className="rounded-xl bg-secondary/30 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{obj.name}</p>
                      <span className="text-xs text-muted-foreground capitalize">{obj.owner}</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(obj.progress ?? 0, 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">{obj.progress ?? 0}% complete</p>
                      {pacing && (
                        <p className={`text-xs ${pacing.ahead ? "text-green-500" : "text-amber-500"}`}>
                          {pacing.ahead ? "Ahead of" : "Behind"} pace ({pacing.variance > 0 ? "+" : ""}{pacing.variance}%)
                        </p>
                      )}
                    </div>
                    <KeyResultsPanel objectiveId={obj.id} addLabel={t("performance.page.addKeyResult")} />
                  </div>
                )
              })}
            </div>
          ) : (
             <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">{t("performance.page.noObjectives")}</div>
          )}
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-6">
           <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
             <TrendingUp className="h-5 w-5 text-green-500" />{t("performance.page.keyDrivers")}
           </h3>
          {drivers.length > 0 ? (
            <div className="space-y-3">
              {drivers.map((d, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-secondary/30 p-3">
                  <span className="text-sm font-medium capitalize">{d.driver.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${d.direction === "up" ? "bg-green-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(Math.abs(d.contribution), 100)}%` }} />
                    </div>
                    <span className={`text-xs font-medium ${d.direction === "up" ? "text-green-500" : "text-red-500"}`}>
                      {d.direction === "up" ? "+" : ""}{d.contribution.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">{t("performance.page.noDriverData")}</div>
          )}
        </div>
      </div>
    </div>
  )
}
