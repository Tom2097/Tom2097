"use client"

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Activity, Zap, Shield, Crown, Lock, RefreshCw, AlertTriangle, BarChart2, MessageSquare, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ModuleCard, ModuleGrid } from '@/components/digit/module-card'
import { ChartContainer } from '@/components/digit/live-chart'
import { LiveChart } from '@/components/digit/live-chart'
import { RealTimeChart } from '@/components/digit/real-time-chart'
import { modules } from '@/lib/modules'
import { getPlanById, formatPrice } from '@/lib/products'
import { useI18n } from '@/components/providers/i18n-provider'

interface DashboardContentProps {
  stats: any
  revenueData: any[]
  operationalData: any[]
  riskData: any[]
  forecastData: any[]
  anomalies: { anomalies: any[] }
  subscription: { plan_id: string; status: string; current_period_end: string | null } | null
  operations: any[]
  activeOperationsCount: number
  communicationVolume: number
  documentsProcessed: number
}

export default function DashboardContent({
  stats,
  revenueData,
  operationalData,
  riskData,
  forecastData,
  anomalies,
  subscription,
  operations,
  activeOperationsCount,
  communicationVolume,
  documentsProcessed,
}: DashboardContentProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()

  const isTrialing = subscription?.status === 'trialing'
  const isActive = subscription?.status === 'active'
  const hasSubscription = isTrialing || isActive
  const plan = subscription ? getPlanById(subscription.plan_id) : null

  const accessibleModuleCount = plan?.limits.modules || 1
  const accessibleModules = modules.slice(0, accessibleModuleCount)
  const lockedModules = modules.slice(accessibleModuleCount)

  return (
    <div className="space-y-8">
      {isActive && plan && (
        <Card className="p-4 border-chart-2/30 bg-chart-2/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-chart-2/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-chart-2" />
              </div>
               <div>
                 <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{plan.name} {t("dashboard.subscription.active.planSuffix")}</p>
                    <Badge variant="secondary" className="bg-chart-2/20 text-chart-2 border-chart-2/30">{t("dashboard.subscription.active.activeBadge")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                   {plan.limits.modules} {t("dashboard.subscription.active.modules")} | {plan.limits.users === -1 ? t("dashboard.subscription.active.unlimited") : plan.limits.users} {t("dashboard.subscription.active.users")} | {formatPrice(plan.priceInCents)}{t("dashboard.subscription.active.perMonth")}
                 </p>
              </div>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" size="sm" asChild>
                 <Link href="/settings">{t("dashboard.subscription.active.manage")}</Link>
               </Button>
               {plan.id !== 'enterprise' && (
                 <Button size="sm" asChild>
                   <Link href="/pricing">{t("dashboard.subscription.active.upgrade")}</Link>
                 </Button>
               )}
            </div>
          </div>
        </Card>
      )}

      <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-card to-card/50 p-8 lg:p-12">
        <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Activity className="h-4 w-4" />
                <span>{t("dashboard.hero.liveIntelligence")}</span>
              </div>

              <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
              {t("dashboard.hero.description")}
            </h1>

            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg" className="gap-2 digit-glow">
                <Link href="/analytics">
                  <Zap className="h-4 w-4" />
                  {t("dashboard.hero.launchAnalytics")}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2">
                <Link href="#modules">
                  {t("dashboard.hero.exploreModules")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="hidden lg:flex lg:justify-center">
            <div className="relative h-80 w-80">
              <div className="absolute inset-0 animate-spin rounded-full border border-primary/30 [animation-duration:20s]" />
              <div className="absolute inset-8 animate-spin rounded-full border border-primary/40 [animation-duration:15s] [animation-direction:reverse]" />
              <div className="absolute inset-16 animate-spin rounded-full border border-primary/50 [animation-duration:10s]" />
              <div className="absolute inset-24 flex items-center justify-center rounded-full bg-primary digit-glow-lg">
                <span className="text-3xl font-bold text-primary-foreground">AI</span>
              </div>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-medium text-primary">
                {t("dashboard.hero.aiNetwork")}
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs font-medium text-primary">
                {t("dashboard.hero.enterpriseSystems")}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </section>

       <section>
         <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{t("dashboard.liveMetrics.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("dashboard.liveMetrics.subtitle")}</p>
            </div>
           <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-sm"
                disabled={isRefreshing}
                onClick={() => startRefresh(() => router.refresh())}
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
                {t("dashboard.liveMetrics.refresh")}
              </Button>
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              <span className="text-sm font-medium text-emerald-500">{t("dashboard.liveMetrics.systemsOperational")}</span>
           </div>
         </div>

         {stats ? (
           <MetricGrid columns={4}>
              <MetricCard label={t("dashboard.metrics.activeOperations")} value={activeOperationsCount} subtitle={t("dashboard.metrics.runningWorkflows")} />
              <MetricCard label={t("dashboard.metrics.riskScore")} value={riskData.length > 0 ? `${Math.round(riskData[riskData.length - 1].value)}` : '0'} subtitle={t("dashboard.metrics.currentRiskLevel")} />
              <MetricCard label={t("dashboard.metrics.anomaliesDetected")} value={anomalies.anomalies.length} subtitle={t("dashboard.metrics.last30Days")} />
              <MetricCard label={t("dashboard.metrics.forecastGrowth")} value={forecastData && forecastData.length >= 2 ? `${Math.round(((forecastData[forecastData.length - 1].forecast - (forecastData[0].actual || 0)) / ((forecastData[0].actual || 1))) * 100)}%` : '0%'} subtitle={t("dashboard.metrics.next6Months")} />
           </MetricGrid>
         ) : (
            <Card className="p-6 text-sm text-muted-foreground">
              {t("dashboard.metrics.noMetrics")}
            </Card>
         )}
       </section>

       <section className="grid gap-6 lg:grid-cols-2">
          <ChartContainer
            title={t("dashboard.charts.revenueForecast.title")}
            subtitle={t("dashboard.charts.revenueForecast.subtitle")}
            className="lg:col-span-1"
          >
           {revenueData.length > 0 ? (
             <RealTimeChart
               data={revenueData.map(d => ({ ...d, timestamp: d.name }))}
               dataKey="value"
               type="area"
               height={280}
               anomalies={anomalies.anomalies}
               forecast={forecastData}
             />
           ) : (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                {t("dashboard.charts.revenueForecast.noData")}
              </div>
           )}
          </ChartContainer>

          <ChartContainer
            title={t("dashboard.charts.operationalPerformance.title")}
            subtitle={t("dashboard.charts.operationalPerformance.subtitle")}
            className="lg:col-span-1"
          >
           {operationalData.length > 0 ? (
             <RealTimeChart
               data={operationalData.map(d => ({ ...d, timestamp: d.name }))}
               dataKey="value"
               type="line"
               height={280}
             />
           ) : (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                {t("dashboard.charts.operationalPerformance.noData")}
              </div>
           )}
          </ChartContainer>
       </section>

       <section>
         <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{t("dashboard.riskCompliance.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("dashboard.riskCompliance.subtitle")}</p>
            </div>
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {anomalies.anomalies.length} {t("dashboard.riskCompliance.activeAlerts")}
            </Badge>
         </div>

         <div className="grid gap-6 lg:grid-cols-3">
           <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{t("dashboard.riskCompliance.riskExposure")}</h3>
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
               {riskData.length > 0 ? (
                 <LiveChart data={riskData.map(point => ({
                   name: new Date((point as any).timestamp).toLocaleDateString(),
                   value: (point as any).value,
                 }))} dataKey="value" type="line" height={200} />
               ) : (
                <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                  {t("dashboard.riskCompliance.noRiskData")}
                </div>
              )}
           </Card>

           <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{t("dashboard.riskCompliance.anomalyDetection")}</h3>
                <BarChart2 className="h-5 w-5 text-red-500" />
              </div>
              <div className="space-y-3">
                {anomalies.anomalies.slice(0, 5).map((anomaly, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className="text-sm">{anomaly.type.replace('_', ' ')}</span>
                    </div>
                    <Badge variant={anomaly.severity === 'critical' ? 'destructive' : anomaly.severity === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                      {anomaly.severity}
                    </Badge>
                  </div>
                ))}
                {anomalies.anomalies.length === 0 && (
                  <div className="flex h-[150px] items-center justify-center text-sm text-muted-foreground">
                    {t("dashboard.riskCompliance.noAnomalies")}
                  </div>
                )}
              </div>
           </Card>

           <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{t("dashboard.riskCompliance.networkStatus")}</h3>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="rounded-xl bg-secondary/50 p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{stats ? stats.uptime : '--'}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.riskCompliance.uptime")}</p>
                </div>
                <div className="rounded-xl bg-secondary/50 p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{stats ? Math.round(stats.response_time) : '--'}ms</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.riskCompliance.response")}</p>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-muted-foreground">{t("dashboard.riskCompliance.activeMonitors")}</p>
                <div className="space-y-2">
                  {operations.length > 0 ? (
                    operations.map((monitor) => (
                      <div
                        key={monitor.id}
                        className="flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2 text-sm"
                      >
                        <Shield className="h-3.5 w-3.5 text-primary" />
                        <span className="text-secondary-foreground">{monitor.name}</span>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
                      {t("dashboard.riskCompliance.noMonitors")}
                    </p>
                  )}
                </div>
              </div>
           </Card>
         </div>
       </section>

       <section>
          <h2 className="text-2xl font-bold text-foreground mb-6">{t("dashboard.keyMetrics.title")}</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{t("dashboard.keyMetrics.communicationVolume.title")}</h3>
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-3xl font-bold">{communicationVolume.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">{t("dashboard.keyMetrics.communicationVolume.subtitle")}</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{t("dashboard.keyMetrics.documentProcessing.title")}</h3>
                <FileText className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-3xl font-bold">{documentsProcessed.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">{t("dashboard.keyMetrics.documentProcessing.subtitle")}</p>
            </Card>
          </div>
       </section>

      <section id="modules">
        <div className="mb-6 flex items-center justify-between">
           <div>
             <h2 className="text-2xl font-bold text-foreground">{t("dashboard.modules.title")}</h2>
             <p className="text-sm text-muted-foreground">
               {hasSubscription
                 ? t("dashboard.modules.accessible", { count: accessibleModuleCount, total: modules.length })
                 : t("dashboard.modules.fallbackDescription")}
             </p>
           </div>
        </div>

        <ModuleGrid>
          {accessibleModules.map((module) => (
            <ModuleCard
              key={module.id}
              id={module.id}
              title={module.title}
              icon={module.icon}
              description={module.description}
              metrics={module.metrics}
              href={module.href}
            />
          ))}

          {lockedModules.map((module) => (
            <div key={module.id} className="relative">
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 rounded-2xl flex flex-col items-center justify-center">
                <Lock className="w-8 h-8 text-muted-foreground mb-2" />
                 <p className="text-sm font-medium text-muted-foreground">{t("dashboard.modules.upgradeToUnlock")}</p>
                 <Button size="sm" variant="outline" className="mt-3" asChild>
                   <Link href="/pricing">{t("dashboard.modules.viewPlans")}</Link>
                 </Button>
              </div>
              <ModuleCard
                id={module.id}
                title={module.title}
                icon={module.icon}
                description={module.description}
                metrics={module.metrics}
                href="#"
              />
            </div>
          ))}
        </ModuleGrid>
      </section>
    </div>
  )
}
