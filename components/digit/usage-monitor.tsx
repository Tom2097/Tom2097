"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, CheckCircle2, Info, BarChart2, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChartContainer, LiveChart } from '@/components/digit/live-chart'

interface UsageData {
  hasExceeded: boolean
  exceededLimits: Array<{
    usageType: string
    currentUsage: number
    limit: number
    percentage: number
  }>
  currentUsage: Record<string, number>
  usageStatistics: {
    totalUsage: number
    usageByType: Record<string, number>
    usageOverTime: Array<{
      date: string
      usage: number
    }>
  }
}

export function UsageMonitor() {
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('month')
  const [error, setError] = useState<string | null>(null)

  const fetchUsageData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/v1/billing/usage')
      const data = await response.json()
      
      if (response.ok) {
        setUsageData(data)
      } else {
        setError(data.error || 'Failed to load usage data')
      }
    } catch (err) {
      setError('Error loading usage data')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      await fetchUsageData()
    }
    load()
  }, [timeRange, fetchUsageData])

  const getTimeRangeDates = () => {
    const now = new Date()
    let startDate: Date
    
    switch (timeRange) {
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }
    
    return {
      startDate,
      endDate: now
    }
  }

  const getUsageChartData = () => {
    if (!usageData?.usageStatistics?.usageOverTime) return []
    
    return usageData.usageStatistics.usageOverTime.map(item => ({
      date: item.date,
      usage: item.usage
    }))
  }

  const getTopUsageTypes = () => {
    if (!usageData?.usageStatistics?.usageByType) return []
    
    return Object.entries(usageData.usageStatistics.usageByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, usage]) => ({ type, usage }))
  }

  const formatUsageType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  const getUsageStatus = (usage: number, limit: number) => {
    if (limit === -1) return 'unlimited'
    if (usage > limit) return 'exceeded'
    if (usage > limit * 0.8) return 'warning'
    if (usage > limit * 0.5) return 'caution'
    return 'normal'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'exceeded': return <AlertCircle className="h-4 w-4 text-destructive" />
      case 'warning': return <AlertTriangle className="h-4 w-4 text-warning" />
      case 'caution': return <Info className="h-4 w-4 text-caution" />
      default: return <CheckCircle2 className="h-4 w-4 text-success" />
    }
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Usage Monitor</CardTitle>
          <CardDescription>Track your usage of AI and operational features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Usage Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-destructive">
            <AlertCircle className="h-6 w-6 mr-2" />
            {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!usageData) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Usage Monitor</h2>
          <p className="text-sm text-muted-foreground">Track your usage of AI and operational features</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Last 7 days</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="quarter">This quarter</SelectItem>
            <SelectItem value="year">This year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {usageData.hasExceeded && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Usage Limits Exceeded
            </CardTitle>
            <CardDescription>
              You have exceeded your plan&apos;s usage limits. Consider upgrading your plan or reducing usage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {usageData.exceededLimits.map((limit) => (
                <div key={limit.usageType} className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                  <div>
                    <div className="font-medium">{formatUsageType(limit.usageType)}</div>
                    <div className="text-sm text-muted-foreground">
                      {limit.currentUsage} of {limit.limit} ({Math.round(limit.percentage)}%)
                    </div>
                  </div>
                  <Badge variant="destructive">Exceeded</Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline">Reduce Usage</Button>
              <Button>Upgrade Plan</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{usageData.usageStatistics.totalUsage}</div>
            <p className="text-sm text-muted-foreground">Total operations this {timeRange}</p>
            <div className="mt-4">
              <ChartContainer className="p-0">
                <LiveChart
                  data={getUsageChartData()}
                  dataKey="usage"
                  type="line"
                  height={100}
                  color="hsl(var(--primary))"
                />
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Usage Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getTopUsageTypes().map((item) => {
                const limit = usageData.exceededLimits.find(l => l.usageType === item.type)?.limit || -1
                const status = getUsageStatus(item.usage, limit)
                
                return (
                  <div key={item.type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      <span className="text-sm">{formatUsageType(item.type)}</span>
                    </div>
                    <span className="font-medium">{item.usage}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Usage Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(usageData.currentUsage).map(([usageType, usage]) => {
                const limit = usageData.exceededLimits.find(l => l.usageType === usageType)?.limit || -1
                const status = getUsageStatus(usage, limit)
                const percentage = limit > 0 ? Math.round((usage / limit) * 100) : 0
                
                return (
                  <div key={usageType} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(status)}
                        <span>{formatUsageType(usageType)}</span>
                      </div>
                      <span>
                        {usage} {limit > 0 && `/ ${limit}`}
                        {limit === -1 && ' (Unlimited)'}
                      </span>
                    </div>
                    {limit > 0 && (
                      <Progress
                        value={Math.min(percentage, 100)}
                        className="h-2"

                      />
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage Details</CardTitle>
          <CardDescription>Detailed usage breakdown by feature</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Feature</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Usage</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Limit</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(usageData.currentUsage).map(([usageType, usage]) => {
                  const limit = usageData.exceededLimits.find(l => l.usageType === usageType)?.limit || -1
                  const status = getUsageStatus(usage, limit)
                  const percentage = limit > 0 ? Math.round((usage / limit) * 100) : 0
                  
                  return (
                    <tr key={usageType} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 text-sm">{formatUsageType(usageType)}</td>
                      <td className="px-4 py-3 text-sm">
                        {usage} {limit > 0 && `(${percentage}%)`}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {limit === -1 ? 'Unlimited' : limit}
                      </td>
                      <td className="px-4 py-3 text-sm">
                         <Badge variant={status === 'exceeded' ? 'destructive' : 
                                       status === 'warning' ? 'secondary' : 
                                       status === 'caution' ? 'secondary' : 'default'}
                        >
                          {status === 'exceeded' ? 'Exceeded' : 
                           status === 'warning' ? 'Warning' : 
                           status === 'caution' ? 'Caution' : 'Normal'}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}