import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Activity, Zap, Shield, Globe, Crown, Lock, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ModuleCard, ModuleGrid } from '@/components/digit/module-card'
import { ChartContainer, LiveChart } from '@/components/digit/live-chart'
import { modules } from '@/lib/modules'
import { getPlanById, formatPrice } from '@/lib/products'
import { createServiceClient } from '@/lib/supabase/service'
import { extractTenantContext } from '@/lib/multitenant/context'
import { getDashboardStats, getRevenueMetrics, getOperationalMetrics } from '@/lib/dashboard/queries'
import { listMonitors } from '@/lib/monitoring/engine'

// Tenant-scoped, always rendered with fresh data.
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const ctx = await extractTenantContext()
  if (!ctx) redirect('/auth/login')
  const orgId = ctx.organizationId

  const db = createServiceClient()
  const [stats, revenueData, operationalData, subResult, monitorsResult] = await Promise.all([
    getDashboardStats(orgId),
    getRevenueMetrics(orgId),
    getOperationalMetrics(orgId),
    db
      .from('subscriptions')
      .select('plan_id, status, current_period_end')
      .eq('organization_id', orgId)
      .maybeSingle(),
    listMonitors(orgId, { enabledOnly: true, limit: 4 }).catch(() => ({ monitors: [], total: 0 })),
  ])

  const subscription = subResult.data as
    | { plan_id: string; status: string; current_period_end: string | null }
    | null
  const isTrialing = subscription?.status === 'trialing'
  const isActive = subscription?.status === 'active'
  const hasSubscription = isTrialing || isActive
  const plan = subscription ? getPlanById(subscription.plan_id) : null

  // Module access is gated by the plan's module allowance.
  const accessibleModuleCount = plan?.limits.modules || 1
  const accessibleModules = modules.slice(0, accessibleModuleCount)
  const lockedModules = modules.slice(accessibleModuleCount)

  const operations = monitorsResult.monitors

  return (
    <div className="space-y-8">
      {/* Subscription Banner */}
      {isTrialing && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="font-medium text-foreground">You&apos;re on a 7-day free trial</p>
                <p className="text-sm text-muted-foreground">
                  {subscription?.current_period_end
                    ? `Trial ends ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : 'Upgrade to unlock all features'}
                </p>
              </div>
            </div>
            <Button asChild>
              <Link href="/pricing">
                Upgrade Now
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </Card>
      )}

      {isActive && plan && (
        <Card className="p-4 border-chart-2/30 bg-chart-2/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-chart-2/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{plan.name} Plan</p>
                  <Badge className="bg-chart-2/20 text-chart-2 border-chart-2/30">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {plan.limits.modules} modules | {plan.limits.users === -1 ? 'Unlimited' : plan.limits.users} users | {formatPrice(plan.priceInCents)}/mo
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings">Manage</Link>
              </Button>
              {plan.id !== 'enterprise' && (
                <Button size="sm" asChild>
                  <Link href="/pricing">Upgrade</Link>
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-card to-card/50 p-8 lg:p-12">
        <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Activity className="h-4 w-4" />
              <span>Live Enterprise Intelligence</span>
            </div>

            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
              Centralized Operational Intelligence System
            </h1>

            <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              DigiT is building a connected ecosystem for AI-powered business software solutions.
              An intelligent framework that learns from enterprise operations, improves workflows,
              predicts outcomes, and enables better decision-making.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg" className="gap-2 digit-glow">
                <Link href="/analytics">
                  <Zap className="h-4 w-4" />
                  Launch AI Analytics
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2">
                <Link href="#modules">
                  Explore Modules
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* AI Core Visualization */}
          <div className="hidden lg:flex lg:justify-center">
            <div className="relative h-80 w-80">
              <div className="absolute inset-0 animate-spin rounded-full border border-primary/30 [animation-duration:20s]" />
              <div className="absolute inset-8 animate-spin rounded-full border border-primary/40 [animation-duration:15s] [animation-direction:reverse]" />
              <div className="absolute inset-16 animate-spin rounded-full border border-primary/50 [animation-duration:10s]" />
              <div className="absolute inset-24 flex items-center justify-center rounded-full bg-primary digit-glow-lg">
                <span className="text-3xl font-bold text-primary-foreground">AI</span>
              </div>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-medium text-primary">
                AI NETWORK
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs font-medium text-primary">
                ENTERPRISE SYSTEMS
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </section>

      {/* Live Metrics */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Live Metrics</h2>
            <p className="text-sm text-muted-foreground">Real-time operational intelligence monitoring</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            <span className="text-sm font-medium text-emerald-500">Systems Operational</span>
          </div>
        </div>

        {stats ? (
          <MetricGrid columns={4}>
            <MetricCard label="AI Accuracy" value={`${stats.ai_accuracy}%`} variant="highlight" />
            <MetricCard label="Enterprise Clients" value={`${stats.enterprise_clients}+`} />
            <MetricCard
              label="Data Streams"
              value={stats.data_streams >= 1_000_000 ? `${(stats.data_streams / 1_000_000).toFixed(0)}M+` : stats.data_streams.toLocaleString()}
            />
            <MetricCard label="Active Operations" value={stats.active_operations} subtitle="Running AI workflows" />
          </MetricGrid>
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">
            No operational metrics recorded yet. Stats will appear here once your workspace begins reporting.
          </Card>
        )}
      </section>

      {/* Charts Section */}
      <section className="grid gap-6 lg:grid-cols-3">
        <ChartContainer
          title="Enterprise Revenue Forecast"
          subtitle="AI prediction model indicates strong operational growth"
          className="lg:col-span-2"
        >
          {revenueData.length > 0 ? (
            <LiveChart data={revenueData} dataKey="value" type="area" height={280} />
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              No revenue data available yet.
            </div>
          )}
        </ChartContainer>

        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Network Status</h3>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-secondary/50 p-4 text-center">
              <p className="text-3xl font-bold text-primary">{stats ? stats.uptime : '--'}%</p>
              <p className="mt-1 text-xs text-muted-foreground">Uptime</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4 text-center">
              <p className="text-3xl font-bold text-primary">{stats ? Math.round(stats.response_time) : '--'}ms</p>
              <p className="mt-1 text-xs text-muted-foreground">Response</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Active Monitors</p>
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
                  No active monitors configured.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise AI Modules */}
      <section id="modules">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Enterprise AI Modules</h2>
            <p className="text-sm text-muted-foreground">
              {hasSubscription
                ? `You have access to ${accessibleModuleCount} of ${modules.length} modules`
                : 'Intelligent systems connected through one operational ecosystem'}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Globe className="h-4 w-4" />
            View All Systems
          </Button>
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
                <p className="text-sm font-medium text-muted-foreground">Upgrade to unlock</p>
                <Button size="sm" variant="outline" className="mt-3" asChild>
                  <Link href="/pricing">View Plans</Link>
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

      {/* Operational Performance */}
      <section>
        <ChartContainer title="Operational Performance" subtitle="24-hour system performance metrics">
          {operationalData.length > 0 ? (
            <LiveChart data={operationalData} dataKey="value" type="line" height={250} />
          ) : (
            <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
              No operational performance data available yet.
            </div>
          )}
        </ChartContainer>
      </section>

      {/* Upgrade CTA for Trial Users */}
      {isTrialing && (
        <section>
          <Card className="p-8 bg-gradient-to-br from-primary/10 to-chart-2/10 border-primary/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Unlock Full AI Power</h2>
                <p className="text-muted-foreground max-w-xl">
                  Upgrade your plan to access all {modules.length} platform modules, unlimited team members,
                  advanced AI predictions, and dedicated enterprise support.
                </p>
              </div>
              <Button size="lg" asChild>
                <Link href="/pricing">
                  View Pricing
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </Card>
        </section>
      )}
    </div>
  )
}
