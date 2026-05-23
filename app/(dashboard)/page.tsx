'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Activity, Zap, Shield, Globe, Crown, Lock, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ModuleCard, ModuleGrid } from '@/components/digit/module-card'
import { ChartContainer, LiveChart } from '@/components/digit/live-chart'
import { modules, dashboardStats, generateRevenueForecast, generateOperationalMetrics, activeOperations } from '@/lib/mock-data'
import { createClient } from '@/lib/supabase/client'
import { getPlanById, formatPrice } from '@/lib/products'

interface Subscription {
  plan_id: string
  status: string
  current_period_end: string | null
}

export default function DashboardPage() {
  const [revenueData, setRevenueData] = useState(generateRevenueForecast())
  const [operationalData, setOperationalData] = useState(generateOperationalMetrics())
  const [stats, setStats] = useState(dashboardStats)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  const plan = subscription ? getPlanById(subscription.plan_id) : null
  const isTrialing = subscription?.status === 'trialing'
  const isActive = subscription?.status === 'active'
  const hasSubscription = isTrialing || isActive

  // Determine which modules are accessible based on plan
  const accessibleModuleCount = plan?.limits.modules || 1
  const accessibleModules = modules.slice(0, accessibleModuleCount)
  const lockedModules = modules.slice(accessibleModuleCount)

  useEffect(() => {
    const fetchSubscription = async () => {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single()

        if (profile?.organization_id) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('plan_id, status, current_period_end')
            .eq('organization_id', profile.organization_id)
            .single()

          if (sub) {
            setSubscription(sub)
          }
        }
      }
      setLoading(false)
    }

    fetchSubscription()
  }, [])

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        activeOperations: prev.activeOperations + Math.floor(Math.random() * 3) - 1,
        responseTime: Math.max(8, Math.min(20, prev.responseTime + (Math.random() - 0.5) * 2))
      }))
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-8">
      {/* Subscription Banner */}
      {!loading && (
        <>
          {isTrialing && (
            <Card className="p-4 border-amber-500/30 bg-amber-500/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">You&apos;re on a 14-day free trial</p>
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
        </>
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
              {/* Animated rings */}
              <div className="absolute inset-0 animate-spin rounded-full border border-primary/30 [animation-duration:20s]" />
              <div className="absolute inset-8 animate-spin rounded-full border border-primary/40 [animation-duration:15s] [animation-direction:reverse]" />
              <div className="absolute inset-16 animate-spin rounded-full border border-primary/50 [animation-duration:10s]" />
              
              {/* Core */}
              <div className="absolute inset-24 flex items-center justify-center rounded-full bg-primary digit-glow-lg">
                <span className="text-3xl font-bold text-primary-foreground">AI</span>
              </div>
              
              {/* Labels */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-medium text-primary">
                AI NETWORK
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs font-medium text-primary">
                ENTERPRISE SYSTEMS
              </div>
            </div>
          </div>
        </div>
        
        {/* Background decoration */}
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
        
        <MetricGrid columns={4}>
          <MetricCard 
            label="AI Accuracy" 
            value={`${stats.aiAccuracy}%`}
            change={2.3}
            trend="up"
            variant="highlight"
          />
          <MetricCard 
            label="Enterprise Clients" 
            value={`${stats.enterpriseClients}+`}
            change={15}
            trend="up"
          />
          <MetricCard 
            label="Data Streams" 
            value={`${(stats.dataStreams / 1000000).toFixed(0)}M+`}
            trend="stable"
          />
          <MetricCard 
            label="Active Operations" 
            value={stats.activeOperations}
            subtitle="Running AI workflows"
          />
        </MetricGrid>
      </section>

      {/* Charts Section */}
      <section className="grid gap-6 lg:grid-cols-3">
        <ChartContainer 
          title="Enterprise Revenue Forecast" 
          subtitle="AI prediction model indicates strong operational growth"
          className="lg:col-span-2"
        >
          <LiveChart 
            data={revenueData} 
            dataKey="value" 
            type="area"
            height={280}
          />
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
              <p className="text-3xl font-bold text-primary">{stats.uptime}%</p>
              <p className="mt-1 text-xs text-muted-foreground">Uptime</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4 text-center">
              <p className="text-3xl font-bold text-primary">{Math.round(stats.responseTime)}ms</p>
              <p className="mt-1 text-xs text-muted-foreground">Response</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-sm font-medium text-muted-foreground">Active AI Operations</p>
            <div className="space-y-2">
              {activeOperations.slice(0, 4).map((operation, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2 text-sm"
                >
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span className="text-secondary-foreground">{operation}</span>
                </div>
              ))}
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
                ? `You have access to ${accessibleModuleCount} of 6 modules`
                : 'Intelligent systems connected through one operational ecosystem'}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Globe className="h-4 w-4" />
            View All Systems
          </Button>
        </div>
        
        <ModuleGrid>
          {/* Accessible Modules */}
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

          {/* Locked Modules */}
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

      {/* Live Dashboard Preview */}
      <section>
        <ChartContainer 
          title="Operational Performance" 
          subtitle="24-hour system performance metrics"
        >
          <LiveChart 
            data={operationalData} 
            dataKey="value" 
            type="line"
            height={250}
          />
        </ChartContainer>
      </section>

      {/* Upgrade CTA for Trial Users */}
      {isTrialing && (
        <section>
          <Card className="p-8 bg-gradient-to-br from-primary/10 to-chart-2/10 border-primary/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Unlock Full AI Power
                </h2>
                <p className="text-muted-foreground max-w-xl">
                  Upgrade your plan to access all 6 industry modules, unlimited team members, 
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
