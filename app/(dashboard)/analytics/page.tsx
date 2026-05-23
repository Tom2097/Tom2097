'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Target,
  Lightbulb,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ChartContainer, LiveChart, MultiLineChart } from '@/components/digit/live-chart'
import { 
  generateRevenueForecast, 
  generateRiskData, 
  generateOperationalMetrics,
  generateTimeSeriesData 
} from '@/lib/mock-data'

export default function AnalyticsPage() {
  const [revenueData, setRevenueData] = useState(generateRevenueForecast())
  const [riskData, setRiskData] = useState(generateRiskData())
  const [operationalData, setOperationalData] = useState(generateOperationalMetrics())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState('30d')

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setRevenueData(generateRevenueForecast())
    setRiskData(generateRiskData())
    setOperationalData(generateOperationalMetrics())
    setIsRefreshing(false)
  }

  // Simulated real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setOperationalData(generateOperationalMetrics())
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Calculate summary metrics
  const totalRevenue = revenueData.reduce((sum, item) => sum + item.value, 0)
  const avgRisk = Math.round(riskData.reduce((sum, item) => sum + item.value, 0) / riskData.length)
  const highRiskCount = riskData.filter(item => item.value > 60).length

  const aiInsights = [
    {
      type: 'opportunity',
      title: 'Revenue Growth Opportunity',
      description: 'Q3 projections show 15% above target. Consider expanding marketing spend.',
      impact: '+$2.4M potential'
    },
    {
      type: 'warning',
      title: 'Operational Risk Alert',
      description: 'Cyber security risk score elevated. Review access controls.',
      impact: 'High priority'
    },
    {
      type: 'insight',
      title: 'Market Trend Detected',
      description: 'Competitor pricing shift detected. AI recommends price optimization.',
      impact: '+8% margin'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI Analytics</h1>
              <p className="text-sm text-muted-foreground">Enterprise intelligence and predictive analytics</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod} className="hidden sm:block">
            <TabsList>
              <TabsTrigger value="7d">7D</TabsTrigger>
              <TabsTrigger value="30d">30D</TabsTrigger>
              <TabsTrigger value="90d">90D</TabsTrigger>
              <TabsTrigger value="1y">1Y</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="sr-only">Refresh data</span>
          </Button>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
            <span className="sr-only">Filter</span>
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
            <span className="sr-only">Export</span>
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <MetricGrid columns={4}>
        <MetricCard 
          label="Total Revenue (YTD)" 
          value={`$${(totalRevenue / 1000000).toFixed(1)}M`}
          change={12.5}
          trend="up"
          variant="highlight"
        />
        <MetricCard 
          label="Revenue Forecast" 
          value="+38%"
          subtitle="AI prediction confidence: 94%"
          trend="up"
          change={5.2}
        />
        <MetricCard 
          label="Average Risk Score" 
          value={`${avgRisk}/100`}
          subtitle={`${highRiskCount} high-risk areas`}
          trend={avgRisk > 50 ? 'up' : 'down'}
          change={avgRisk > 50 ? 8 : -12}
        />
        <MetricCard 
          label="AI Operations" 
          value="184"
          subtitle="Active predictive models"
          trend="stable"
        />
      </MetricGrid>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer 
          title="Revenue Forecast" 
          subtitle="Monthly revenue with AI-powered predictions"
        >
          <LiveChart 
            data={revenueData}
            dataKey="value"
            type="area"
            height={300}
          />
        </ChartContainer>

        <ChartContainer 
          title="Risk Analysis" 
          subtitle="Enterprise risk scores by category"
        >
          <LiveChart 
            data={riskData}
            dataKey="value"
            type="bar"
            height={300}
            color="hsl(var(--chart-2))"
          />
        </ChartContainer>
      </div>

      {/* Operational Insights */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartContainer 
          title="Operational Performance" 
          subtitle="24-hour system metrics"
          className="lg:col-span-2"
        >
          <MultiLineChart 
            data={operationalData}
            lines={[
              { dataKey: 'cpu', color: 'hsl(var(--chart-1))', name: 'CPU Usage' },
              { dataKey: 'memory', color: 'hsl(var(--chart-2))', name: 'Memory' },
              { dataKey: 'network', color: 'hsl(var(--chart-3))', name: 'Network' }
            ]}
            height={280}
          />
        </ChartContainer>

        {/* AI Insights Panel */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">AI Insights</h3>
          </div>
          
          <div className="space-y-4">
            {aiInsights.map((insight, i) => (
              <div 
                key={i}
                className="rounded-xl border border-border/50 bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {insight.type === 'opportunity' && (
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    )}
                    {insight.type === 'warning' && (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    {insight.type === 'insight' && (
                      <Target className="h-4 w-4 text-primary" />
                    )}
                    <span className="text-sm font-medium text-foreground">{insight.title}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{insight.description}</p>
                <div className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {insight.impact}
                </div>
              </div>
            ))}
          </div>
          
          <Button variant="outline" size="sm" className="mt-4 w-full">
            View All Insights
          </Button>
        </div>
      </div>

      {/* Predictions Table */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Predictive Analytics</h3>
            <p className="text-sm text-muted-foreground">AI-generated forecasts and recommendations</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Target className="h-4 w-4" />
            Configure Models
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Metric</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Current</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Predicted (30d)</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Confidence</th>
                <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {[
                { metric: 'Revenue', current: '$8.2M', predicted: '$9.4M', confidence: 94, trend: 'up' },
                { metric: 'Customer Acquisition', current: '1,240', predicted: '1,456', confidence: 87, trend: 'up' },
                { metric: 'Churn Rate', current: '2.4%', predicted: '2.1%', confidence: 82, trend: 'down' },
                { metric: 'Operational Costs', current: '$2.1M', predicted: '$2.3M', confidence: 91, trend: 'up' },
                { metric: 'Market Share', current: '12.4%', predicted: '13.1%', confidence: 76, trend: 'up' },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-secondary/30">
                  <td className="py-3 text-sm font-medium text-foreground">{row.metric}</td>
                  <td className="py-3 text-sm text-muted-foreground">{row.current}</td>
                  <td className="py-3 text-sm text-foreground">{row.predicted}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-secondary">
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: `${row.confidence}%` }} 
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{row.confidence}%</span>
                    </div>
                  </td>
                  <td className="py-3">
                    {row.trend === 'up' ? (
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
