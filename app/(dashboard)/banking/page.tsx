'use client'

import { useState } from 'react'
import { 
  Building2, 
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  CreditCard,
  DollarSign,
  Activity
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ChartContainer, LiveChart } from '@/components/digit/live-chart'
import { generateTimeSeriesData, generateRiskData } from '@/lib/mock-data'

const recentTransactions = [
  { id: 1, type: 'Wire Transfer', amount: '$125,000', risk: 'Low', status: 'Completed', time: '2 min ago' },
  { id: 2, type: 'International', amount: '$45,200', risk: 'Medium', status: 'Under Review', time: '5 min ago' },
  { id: 3, type: 'Card Payment', amount: '$2,340', risk: 'Low', status: 'Completed', time: '8 min ago' },
  { id: 4, type: 'Wire Transfer', amount: '$890,000', risk: 'High', status: 'Flagged', time: '12 min ago' },
  { id: 5, type: 'ACH Transfer', amount: '$15,750', risk: 'Low', status: 'Completed', time: '15 min ago' },
]

const marketSignals = [
  { market: 'S&P 500', value: '4,892.45', change: '+1.24%', trend: 'up' },
  { market: 'NASDAQ', value: '15,234.78', change: '+0.87%', trend: 'up' },
  { market: 'EUR/USD', value: '1.0892', change: '-0.15%', trend: 'down' },
  { market: '10Y Treasury', value: '4.28%', change: '+0.05%', trend: 'up' },
]

export default function BankingPage() {
  const [transactionData] = useState(generateTimeSeriesData(24, 50000, 15000).map((d, i) => ({
    name: `${i}:00`,
    value: d.value
  })))
  const [riskData] = useState(generateRiskData())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-4/20 text-chart-4">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Banking Intelligence</h1>
            <p className="text-sm text-muted-foreground">Financial intelligence and fraud monitoring</p>
          </div>
        </div>
        
        <Button className="gap-2" variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          3 Fraud Alerts
        </Button>
      </div>

      {/* Metrics */}
      <MetricGrid columns={4}>
        <MetricCard 
          label="Transaction Volume" 
          value="$48.2M"
          change={8.5}
          trend="up"
          variant="highlight"
        />
        <MetricCard 
          label="Fraud Detected" 
          value="$124K"
          subtitle="12 transactions flagged"
          change={-15}
          trend="down"
        />
        <MetricCard 
          label="Risk Score" 
          value="28/100"
          subtitle="Low risk environment"
          trend="stable"
        />
        <MetricCard 
          label="Processing Time" 
          value="1.2s"
          change={-22}
          trend="down"
        />
      </MetricGrid>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer 
          title="Transaction Volume" 
          subtitle="24-hour transaction flow"
        >
          <LiveChart 
            data={transactionData}
            dataKey="value"
            type="area"
            height={280}
            color="hsl(var(--chart-4))"
          />
        </ChartContainer>

        <ChartContainer 
          title="Risk Categories" 
          subtitle="Current risk assessment by type"
        >
          <LiveChart 
            data={riskData}
            dataKey="value"
            type="bar"
            height={280}
            color="hsl(var(--chart-5))"
          />
        </ChartContainer>
      </div>

      {/* Transactions and Market Signals */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <div className="rounded-2xl border border-border/50 bg-card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Recent Transactions</h3>
            <Button variant="outline" size="sm">View All</Button>
          </div>
          <div className="space-y-3">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    tx.status === 'Flagged' ? 'bg-red-500/20 text-red-500' :
                    tx.status === 'Under Review' ? 'bg-amber-500/20 text-amber-500' :
                    'bg-emerald-500/20 text-emerald-500'
                  }`}>
                    {tx.status === 'Flagged' ? <Shield className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{tx.type}</p>
                    <p className="text-sm text-muted-foreground">{tx.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">{tx.amount}</p>
                  <span className={`text-xs ${
                    tx.risk === 'High' ? 'text-red-500' :
                    tx.risk === 'Medium' ? 'text-amber-500' :
                    'text-emerald-500'
                  }`}>
                    {tx.risk} Risk
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Market Signals */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Market Signals</h3>
          </div>
          <div className="space-y-4">
            {marketSignals.map((signal) => (
              <div key={signal.market} className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
                <div>
                  <p className="font-medium text-foreground">{signal.market}</p>
                  <p className="text-lg font-bold text-foreground">{signal.value}</p>
                </div>
                <div className={`flex items-center gap-1 ${
                  signal.trend === 'up' ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {signal.trend === 'up' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span className="text-sm font-medium">{signal.change}</span>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-4 w-full">
            Full Market Analysis
          </Button>
        </div>
      </div>
    </div>
  )
}
