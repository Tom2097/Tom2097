"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChartContainer, LiveChart } from '@/components/digit/live-chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, Clock, DollarSign, Target, TrendingUp, TrendingDown, Users, Calendar, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Deal {
  id: string
  title: string
  value: number
  stage: string
  probability: number
  currency: string
  expected_close_date: string | null
  created_at: string
  owner_id: string | null
  company_id: string | null
  contact_id: string | null
}

interface SalesAnalyticsData {
  totalDeals: number
  totalValue: number
  averageDealSize: number
  winRate: number
  averageSalesCycle: number
  conversionRates: Record<string, number>
  stageDistribution: Record<string, number>
  valueByStage: Record<string, number>
  dealsOverTime: Array<{
    date: string
    count: number
    value: number
  }>
  topPerformers: Array<{
    owner_id: string
    owner_name: string
    dealCount: number
    totalValue: number
    winRate: number
  }>
  forecastAccuracy: {
    accuracy: number
    variance: number
    historicalAccuracy: Array<{
      period: string
      accuracy: number
    }>
  }
  lostReasons: Array<{
    reason: string
    count: number
    value: number
  }>
}

export function CrmSalesAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<SalesAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('quarter')
  const [filterOwner, setFilterOwner] = useState('all')
  const [filterStage, setFilterStage] = useState('all')
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetchAnalyticsData()
    fetchOwners()
  }, [timeRange, filterOwner, filterStage])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        timeRange,
        ownerId: filterOwner === 'all' ? '' : filterOwner,
        stage: filterStage === 'all' ? '' : filterStage
      })
      
      const response = await fetch(`/api/v1/crm/analytics?${params.toString()}`)
      const data = await response.json()
      
      if (response.ok) {
        setAnalyticsData(data)
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOwners = async () => {
    try {
      const response = await fetch('/api/v1/auth/users')
      const data = await response.json()
      
      if (response.ok) {
        setOwners(data)
      }
    } catch (error) {
      console.error('Error fetching owners:', error)
    }
  }

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'week': return 'Last 7 Days'
      case 'month': return 'Last 30 Days'
      case 'quarter': return 'Last 90 Days'
      case 'year': return 'Last Year'
      case 'all': return 'All Time'
      default: return 'Last 90 Days'
    }
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'lead': return 'bg-gray-500'
      case 'qualified': return 'bg-blue-500'
      case 'proposal': return 'bg-amber-500'
      case 'negotiation': return 'bg-orange-500'
      case 'won': return 'bg-green-500'
      case 'lost': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'lead': return 'Lead'
      case 'qualified': return 'Qualified'
      case 'proposal': return 'Proposal'
      case 'negotiation': return 'Negotiation'
      case 'won': return 'Won'
      case 'lost': return 'Lost'
      default: return stage
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value)
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sales Analytics</CardTitle>
          <CardDescription>Advanced insights into your sales pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!analyticsData) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sales Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Failed to load analytics data
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Sales Analytics</h2>
          <p className="text-sm text-muted-foreground">Advanced insights into your sales pipeline</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterOwner} onValueChange={setFilterOwner}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map(owner => (
                <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="negotiation">Negotiation</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pipeline Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analyticsData.totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              {analyticsData.totalDeals} deals in pipeline
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(analyticsData.winRate * 100)}%
              {analyticsData.winRate >= 0.7 ? (
                <TrendingUp className="h-5 w-5 text-success ml-1 inline" />
              ) : analyticsData.winRate >= 0.5 ? (
                <TrendingUp className="h-5 w-5 text-warning ml-1 inline" />
              ) : (
                <TrendingDown className="h-5 w-5 text-destructive ml-1 inline" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(analyticsData.winRate * analyticsData.totalDeals)} deals won
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Deal Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analyticsData.averageDealSize)}</div>
            <p className="text-xs text-muted-foreground">
              Across {analyticsData.totalDeals} deals
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sales Cycle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.averageSalesCycle} days</div>
            <p className="text-xs text-muted-foreground">
              Avg. time to close
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Forecast Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(analyticsData.forecastAccuracy.accuracy * 100)}%
              {analyticsData.forecastAccuracy.accuracy >= 0.85 ? (
                <CheckCircle2 className="h-5 w-5 text-success ml-1 inline" />
              ) : analyticsData.forecastAccuracy.accuracy >= 0.7 ? (
                <AlertTriangle className="h-5 w-5 text-warning ml-1 inline" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive ml-1 inline" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.abs(Math.round(analyticsData.forecastAccuracy.variance * 100))}% variance
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Value by Stage</CardTitle>
               <CardDescription>Distribution of deal value across pipeline stages</CardDescription>
               </CardHeader>
               <CardContent>
                 <ChartContainer>
                   <LiveChart
                     data={Object.entries(analyticsData.valueByStage).map(([stage, value]) => ({
                       stage: getStageLabel(stage),
                       value
                     }))}
                     dataKey="value"
                    type="bar"
                    height={300}
                    color="hsl(var(--primary))"
                     xAxisKey="stage"
                  />
                </ChartContainer>
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {Object.entries(analyticsData.valueByStage).map(([stage, value]) => (
                    <Badge key={stage} variant="secondary" className={getStageColor(stage)}>
                      {getStageLabel(stage)}: {formatCurrency(value)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Deal Stage Distribution</CardTitle>
                <CardDescription>Number of deals in each stage</CardDescription>
              </CardHeader>
              <CardContent>
                 <ChartContainer>
                   <LiveChart
                     data={Object.entries(analyticsData.stageDistribution).map(([stage, count]) => ({
                       stage: getStageLabel(stage),
                       count
                     }))}
                     dataKey="count"
                     type="bar"
                     xAxisKey="stage"

                  />
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription>Sales reps ranked by performance</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sales Rep</TableHead>
                      <TableHead>Deals</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Win Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyticsData.topPerformers.map((performer) => (
                      <TableRow key={performer.owner_id}>
                        <TableCell className="font-medium">{performer.owner_name}</TableCell>
                        <TableCell>{performer.dealCount}</TableCell>
                        <TableCell>{formatCurrency(performer.totalValue)}</TableCell>
                        <TableCell>
                           <Badge variant={performer.winRate >= 0.7 ? 'default' : performer.winRate >= 0.5 ? 'secondary' : 'destructive'}>
                            {Math.round(performer.winRate * 100)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Conversion Rates</CardTitle>
                <CardDescription>Conversion rates between pipeline stages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analyticsData.conversionRates).map(([stage, rate]) => (
                    <div key={stage} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{getStageLabel(stage)} → {getStageLabel(getNextStage(stage))}</span>
                        <span className="font-medium">{Math.round(rate * 100)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${rate * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Forecast Tab */}
        <TabsContent value="forecast">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Forecast Accuracy</CardTitle>
                <CardDescription>Historical forecast accuracy over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer>
                  <LiveChart
                    data={analyticsData.forecastAccuracy.historicalAccuracy}
                    dataKey="accuracy"
                    type="line"
                    height={300}
                    color="hsl(var(--primary))"
                    xAxisKey="period"
                  />
                </ChartContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Lost Deal Analysis</CardTitle>
                <CardDescription>Reasons for lost deals</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer>
                   <LiveChart
                     data={analyticsData.lostReasons}
                     dataKey="value"
                     type="bar"
                     xAxisKey="reason"
                  />
                </ChartContainer>
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {analyticsData.lostReasons.map((reason) => (
                    <Badge key={reason.reason} variant="secondary">
                      {reason.reason}: {reason.count} deals ({formatCurrency(reason.value)})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Deals Over Time</CardTitle>
                <CardDescription>Number of deals created over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer>
                  <LiveChart
                    data={analyticsData.dealsOverTime}
                    dataKey="count"
                    type="line"
                    height={300}
                    color="hsl(var(--primary))"
                    xAxisKey="date"
                  />
                </ChartContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Value Over Time</CardTitle>
                <CardDescription>Total pipeline value over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer>
                  <LiveChart
                    data={analyticsData.dealsOverTime}
                    dataKey="value"
                    type="area"
                    height={300}
                    color="hsl(var(--primary))"
                    xAxisKey="date"
                  />
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function getNextStage(currentStage: string): string {
  const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']
  const currentIndex = stages.indexOf(currentStage)
  return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : stages[currentIndex]
}