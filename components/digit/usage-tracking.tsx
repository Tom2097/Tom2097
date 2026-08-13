'use client'

import { motion } from 'framer-motion'
import { Activity, Database, Users, Zap, TrendingUp, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { SubscriptionPlan } from '@/lib/products'

interface UsageData {
  dataPoints: number
  apiCalls: number
  teamMembers: number
  modulesUsed: number
}

interface UsageTrackingProps {
  plan: SubscriptionPlan
  usage: UsageData
  className?: string
}

function calculatePercentage(used: number, limit: number): number {
  if (limit === -1) return 0 // Unlimited
  return Math.min(100, Math.round((used / limit) * 100))
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
  return num.toString()
}

export function UsageTracking({ plan, usage, className }: UsageTrackingProps) {
  const dataPointsPercent = calculatePercentage(usage.dataPoints, plan.limits.dataPoints)
  const apiCallsPercent = calculatePercentage(usage.apiCalls, plan.limits.apiCalls)
  const teamPercent = calculatePercentage(usage.teamMembers, plan.limits.users)
  const modulesPercent = calculatePercentage(usage.modulesUsed, plan.limits.modules)

  const isNearLimit = dataPointsPercent > 80 || apiCallsPercent > 80 || teamPercent > 80

  const metrics = [
    {
      label: 'Data Points',
      icon: Database,
      used: usage.dataPoints,
      limit: plan.limits.dataPoints,
      percent: dataPointsPercent,
      unit: '/month'
    },
    {
      label: 'API Calls',
      icon: Zap,
      used: usage.apiCalls,
      limit: plan.limits.apiCalls,
      percent: apiCallsPercent,
      unit: '/month'
    },
    {
      label: 'Team Members',
      icon: Users,
      used: usage.teamMembers,
      limit: plan.limits.users,
      percent: teamPercent,
      unit: ''
    },
    {
      label: 'Active Modules',
      icon: Activity,
      used: usage.modulesUsed,
      limit: plan.limits.modules,
      percent: modulesPercent,
      unit: ''
    }
  ]

  return (
    <Card className={`p-6 border-border/50 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Usage & Limits</h3>
          <p className="text-sm text-muted-foreground">Current billing period</p>
        </div>
        {isNearLimit && (
          <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/10">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Near Limit
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {metrics.map((metric, index) => {
          const MetricIcon = metric.icon
          const isUnlimited = metric.limit === -1
          const isWarning = metric.percent > 80 && !isUnlimited
          const isCritical = metric.percent > 95 && !isUnlimited

          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isCritical ? 'bg-destructive/20' : 
                    isWarning ? 'bg-amber-500/20' : 
                    'bg-primary/10'
                  }`}>
                    <MetricIcon className={`w-4 h-4 ${
                      isCritical ? 'text-destructive' : 
                      isWarning ? 'text-amber-500' : 
                      'text-primary'
                    }`} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{metric.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {isUnlimited ? (
                    <Badge variant="secondary" className="text-xs">Unlimited</Badge>
                  ) : (
                    `${metric.percent}%`
                  )}
                </span>
              </div>

              <Progress 
                value={isUnlimited ? 0 : metric.percent} 
                className={`h-2 ${
                  isCritical ? '[&>div]:bg-destructive' : 
                  isWarning ? '[&>div]:bg-amber-500' : 
                  ''
                }`}
              />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {formatNumber(metric.used)} used
                </span>
                <span>
                  {isUnlimited ? 'No limit' : `${formatNumber(metric.limit)}${metric.unit} limit`}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {isNearLimit && (
        <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-amber-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Approaching usage limits</p>
              <p className="text-xs text-muted-foreground mt-1">
                Consider upgrading your plan to avoid service interruptions.
              </p>
              <Button size="sm" variant="outline" className="mt-3" asChild>
                <Link href="/settings/billing">Upgrade Plan</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// Usage Overview Card for Dashboard
interface UsageOverviewProps {
  plan: SubscriptionPlan
  usage: UsageData
}

export function UsageOverview({ plan, usage }: UsageOverviewProps) {
  const dataPointsPercent = calculatePercentage(usage.dataPoints, plan.limits.dataPoints)
  const apiCallsPercent = calculatePercentage(usage.apiCalls, plan.limits.apiCalls)

  return (
    <Card className="p-4 border-border/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">Usage Overview</span>
        <Link href="/settings" className="text-xs text-primary hover:underline">
          View Details
        </Link>
      </div>
      
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Data Points</span>
            <span className="text-foreground">{dataPointsPercent}%</span>
          </div>
          <Progress value={dataPointsPercent} className="h-1.5" />
        </div>
        
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">API Calls</span>
            <span className="text-foreground">{apiCallsPercent}%</span>
          </div>
          <Progress value={apiCallsPercent} className="h-1.5" />
        </div>
      </div>
    </Card>
  )
}
