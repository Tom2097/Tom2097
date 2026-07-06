"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MetricCard, MetricGrid } from "@/components/digit/metric-card"
import {
  TrendingUp,
  LogOut,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertTriangle,
  BarChart3,
  LineChart,
  PieChart,
  Target,
} from "lucide-react"

interface RevenueMetrics {
  mrr: number
  arr: number
  previousMrr: number
  mrrChange: number
  arrChange: number
  activeSubscriptions: number
  churnRate: number
  previousChurnRate: number
  churnChange: number
  averageRevenuePerUser: number
  lifetimeValue: number
  revenueByPlan: { planName: string; amount: number; subscribers: number }[]
  revenueByRegion: { region: string; amount: number; percentage: number }[]
  monthlyTrend: { month: string; mrr: number; churn: number; newBusiness: number }[]
}

interface ChurnAnalysis {
  totalChurned: number
  voluntaryChurn: number
  involuntaryChurn: number
  churnByReason: { reason: string; count: number }[]
  churnByPlan: { planName: string; count: number }[]
  atRiskAccounts: { name: string; email: string; plan: string; risk: 'low' | 'medium' | 'high' }[]
}

interface RevenueForecast {
  currentMrr: number
  forecastNextMonth: number
  forecastNextQuarter: number
  forecastNextYear: number
  confidence: 'low' | 'medium' | 'high'
  growthRate: number
}

const REGION_COLORS: Record<string, string> = {
  'North India': 'bg-blue-500',
  'South India': 'bg-emerald-500',
  'West India': 'bg-amber-500',
  'East India': 'bg-violet-500',
}

const RISK_COLORS: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
}

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

function getTrendIcon(change: number) {
  if (change > 0) return <ArrowUp className="h-3 w-3 text-emerald-500" />
  if (change < 0) return <ArrowDown className="h-3 w-3 text-red-500" />
  return <Minus className="h-3 w-3 text-muted-foreground" />
}

export default function RevenuePage() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null)
  const [churn, setChurn] = useState<ChurnAnalysis | null>(null)
  const [forecast, setForecast] = useState<RevenueForecast | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/v1/admin/revenue')
        const data = await res.json()
        if (res.ok && !cancelled) {
          setMetrics(data.metrics)
          setChurn(data.churnAnalysis)
          setForecast(data.forecast)
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const maxMrr = metrics ? Math.max(...metrics.monthlyTrend.map(m => m.mrr), 1) : 1
  const maxChurn = metrics ? Math.max(...metrics.monthlyTrend.map(m => m.churn), 1) : 1
  const totalRegionAmount = metrics ? metrics.revenueByRegion.reduce((s, r) => s + r.amount, 0) : 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Revenue Analytics</h1>
        <p className="text-muted-foreground">MRR, ARR, churn, and revenue breakdown</p>
      </div>

      <MetricGrid columns={3}>
        <MetricCard
          label="Monthly Recurring Revenue"
          value={metrics ? formatInr(metrics.mrr) : '...'}
          trend={metrics && metrics.mrrChange > 0 ? 'up' : 'down'}
          change={metrics?.mrrChange}
          subtitle="vs previous month"
        />
        <MetricCard
          label="Annual Run Rate"
          value={metrics ? formatInr(metrics.arr) : '...'}
          trend={metrics && metrics.arrChange > 0 ? 'up' : 'down'}
          change={metrics?.arrChange}
          subtitle="projected"
        />
        <MetricCard label="Active Subscriptions" value={metrics?.activeSubscriptions ?? '...'} trend="up" change={5} />
        <MetricCard
          label="Churn Rate"
          value={metrics ? `${metrics.churnRate}%` : '...'}
          trend={metrics && metrics.churnChange > 0 ? 'up' : 'down'}
          change={metrics?.churnChange}
          subtitle="improvement vs last month"
        />
        <MetricCard label="Avg Revenue / User" value={metrics ? formatInr(metrics.averageRevenuePerUser) : '...'} trend="up" change={3} />
        <MetricCard label="Lifetime Value" value={metrics ? formatInr(metrics.lifetimeValue) : '...'} trend="up" change={8} />
      </MetricGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4" />
              Revenue by Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : !metrics || metrics.revenueByPlan.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No data</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Subscribers</TableHead>
                    <TableHead>Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.revenueByPlan.map((plan) => {
                    const share = ((plan.amount / metrics.mrr) * 100).toFixed(1)
                    return (
                      <TableRow key={plan.planName}>
                        <TableCell className="font-medium">{plan.planName}</TableCell>
                        <TableCell>{formatInr(plan.amount)}</TableCell>
                        <TableCell>{plan.subscribers}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${share}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{share}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <PieChart className="h-4 w-4" />
              Revenue by Region
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : !metrics || metrics.revenueByRegion.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No data</div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-1">
                  {metrics.revenueByRegion.map((region) => {
                    const pct = (region.amount / totalRegionAmount) * 100
                    return (
                      <div
                        key={region.region}
                        className={`h-32 rounded-t-lg transition-all hover:opacity-80 ${REGION_COLORS[region.region] || 'bg-primary'}`}
                        style={{ width: `${pct}%`, minWidth: '40px' }}
                        title={`${region.region}: ${pct.toFixed(1)}%`}
                      />
                    )
                  })}
                </div>
                <div className="space-y-2">
                  {metrics.revenueByRegion.map((region) => (
                    <div key={region.region} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-sm ${REGION_COLORS[region.region] || 'bg-primary'}`} />
                        <span>{region.region}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-medium">{formatInr(region.amount)}</span>
                        <span className="text-muted-foreground w-12 text-right">{region.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <LineChart className="h-4 w-4" />
            Monthly Trend (MRR & Churn)
          </CardTitle>
          <CardDescription>Last 6 months of revenue and churn data</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : !metrics || metrics.monthlyTrend.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No trend data</div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-end gap-[3px] h-48 w-full">
                {metrics.monthlyTrend.map((point, i) => {
                  const mrrHeight = (point.mrr / maxMrr) * 100
                  const churnHeight = (point.churn / maxChurn) * 100
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-[2px]">
                      <div
                        className="w-full bg-red-500/40 rounded-t transition-all min-h-[2px]"
                        style={{ height: `${Math.max(churnHeight, 2)}%` }}
                        title={`Churn: ${point.churn}%`}
                      />
                      <div
                        className="w-full bg-emerald-500/60 rounded-t transition-all min-h-[2px]"
                        style={{ height: `${Math.max(mrrHeight, 2)}%` }}
                        title={`MRR: ${formatInr(point.mrr)}`}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                {metrics.monthlyTrend.map((point, i) => (
                  <span key={i}>{point.month}</span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-emerald-500/60" />
                  <span>MRR</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-red-500/40" />
                  <span>Churn %</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <LogOut className="h-4 w-4" />
              Churn Analysis
            </CardTitle>
            <CardDescription>Voluntary vs involuntary breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="py-4 text-center text-muted-foreground">Loading...</div>
            ) : !churn ? (
              <div className="py-4 text-center text-muted-foreground">No data</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-amber-500/20 bg-amber-500/5">
                    <CardContent className="pt-6 text-center">
                      <LogOut className="mx-auto h-6 w-6 text-amber-500 mb-2" />
                      <div className="text-2xl font-bold">{churn.voluntaryChurn}</div>
                      <p className="text-xs text-muted-foreground">Voluntary Churn</p>
                    </CardContent>
                  </Card>
                  <Card className="border-red-500/20 bg-red-500/5">
                    <CardContent className="pt-6 text-center">
                      <AlertTriangle className="mx-auto h-6 w-6 text-red-500 mb-2" />
                      <div className="text-2xl font-bold">{churn.involuntaryChurn}</div>
                      <p className="text-xs text-muted-foreground">Involuntary Churn</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  Total churned: <span className="font-bold text-foreground">{churn.totalChurned}</span> customers
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Churn by Reason</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-4 text-center text-muted-foreground">Loading...</div>
              ) : !churn || churn.churnByReason.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground">No data</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reason</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {churn.churnByReason.map((r) => (
                      <TableRow key={r.reason}>
                        <TableCell>{r.reason}</TableCell>
                        <TableCell>{r.count}</TableCell>
                        <TableCell>
                          <div className="h-2 w-24 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${(r.count / churn.totalChurned) * 100}%` }} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Churn by Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-4 text-center text-muted-foreground">Loading...</div>
              ) : !churn || churn.churnByPlan.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground">No data</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Churned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {churn.churnByPlan.map((p) => (
                      <TableRow key={p.planName}>
                        <TableCell>{p.planName}</TableCell>
                        <TableCell>{p.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            At-Risk Accounts
          </CardTitle>
          <CardDescription>Accounts showing churn signals</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-4 text-center text-muted-foreground">Loading...</div>
          ) : !churn || churn.atRiskAccounts.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground">No accounts at risk</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Risk Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {churn.atRiskAccounts.map((acct) => (
                  <TableRow key={acct.email}>
                    <TableCell className="font-medium">{acct.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{acct.email}</TableCell>
                    <TableCell><Badge variant="outline">{acct.plan}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={RISK_COLORS[acct.risk]}>
                        {acct.risk === 'high' && <AlertTriangle className="mr-1 h-3 w-3" />}
                        {acct.risk}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4" />
            Revenue Forecast
          </CardTitle>
          <CardDescription>Projected revenue based on current growth rate</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-4 text-center text-muted-foreground">Loading...</div>
          ) : !forecast ? (
            <div className="py-4 text-center text-muted-foreground">No forecast data</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-1">Current MRR</p>
                  <p className="text-2xl font-bold">{formatInr(forecast.currentMrr)}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/30">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-1">Next Month</p>
                  <p className="text-2xl font-bold text-primary">{formatInr(forecast.forecastNextMonth)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    <span className="text-xs text-emerald-500">+{forecast.growthRate}% ARR</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-primary/30">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-1">Next Quarter</p>
                  <p className="text-2xl font-bold text-primary">{formatInr(forecast.forecastNextQuarter)}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/30">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-1">Next Year</p>
                  <p className="text-2xl font-bold text-primary">{formatInr(forecast.forecastNextYear)}</p>
                  <Badge variant="outline" className="mt-2 text-[10px] capitalize">
                    {forecast.confidence} confidence
                  </Badge>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
