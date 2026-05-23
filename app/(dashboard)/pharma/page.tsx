'use client'

import { useState } from 'react'
import { 
  Pill, 
  FlaskConical,
  Shield,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ChartContainer, LiveChart } from '@/components/digit/live-chart'
import { generateTimeSeriesData } from '@/lib/mock-data'

const drugTrials = [
  { name: 'PH-2847', phase: 'Phase III', progress: 78, status: 'On Track', patients: 1240 },
  { name: 'PH-3156', phase: 'Phase II', progress: 45, status: 'On Track', patients: 560 },
  { name: 'PH-1923', phase: 'Phase III', progress: 92, status: 'Completing', patients: 2100 },
  { name: 'PH-4012', phase: 'Phase I', progress: 23, status: 'Recruiting', patients: 180 },
]

const complianceItems = [
  { item: 'FDA Documentation', status: 'Compliant', lastAudit: '2 days ago', score: 98 },
  { item: 'GMP Standards', status: 'Compliant', lastAudit: '1 week ago', score: 96 },
  { item: 'Quality Control', status: 'Review Needed', lastAudit: '3 days ago', score: 89 },
  { item: 'Data Integrity', status: 'Compliant', lastAudit: '5 days ago', score: 99 },
]

const inventoryLevels = [
  { product: 'Raw Materials', level: 82, reorderPoint: 20, status: 'Adequate' },
  { product: 'Active Ingredients', level: 65, reorderPoint: 30, status: 'Adequate' },
  { product: 'Packaging', level: 28, reorderPoint: 25, status: 'Low' },
  { product: 'Finished Goods', level: 71, reorderPoint: 15, status: 'Adequate' },
]

export default function PharmaPage() {
  const [productionData] = useState(generateTimeSeriesData(30, 85, 10).map((d, i) => ({
    name: i + 1,
    value: d.value
  })))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Pill className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pharma Intelligence</h1>
            <p className="text-sm text-muted-foreground">Pharmaceutical enterprise operations and compliance</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Compliance Report
          </Button>
          <Button className="gap-2">
            <FlaskConical className="h-4 w-4" />
            New Trial
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <MetricGrid columns={4}>
        <MetricCard 
          label="Active Trials" 
          value="4"
          subtitle="4,080 patients enrolled"
          variant="highlight"
        />
        <MetricCard 
          label="Production Efficiency" 
          value="94.2%"
          change={2.1}
          trend="up"
        />
        <MetricCard 
          label="Compliance Score" 
          value="96/100"
          subtitle="All audits passed"
          change={1}
          trend="up"
        />
        <MetricCard 
          label="Time to Market" 
          value="18 mo"
          subtitle="Below industry avg"
          change={-8}
          trend="down"
        />
      </MetricGrid>

      {/* Charts and Trials */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer 
          title="Production Efficiency" 
          subtitle="30-day production performance (%)"
        >
          <LiveChart 
            data={productionData}
            dataKey="value"
            type="line"
            height={280}
            color="hsl(var(--primary))"
          />
        </ChartContainer>

        {/* Drug Trials */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Active Drug Trials</h3>
          </div>
          <div className="space-y-4">
            {drugTrials.map((trial) => (
              <div key={trial.name} className="rounded-xl bg-secondary/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{trial.name}</p>
                    <p className="text-sm text-muted-foreground">{trial.phase} - {trial.patients} patients</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    trial.status === 'Completing' ? 'bg-emerald-500/20 text-emerald-500' :
                    trial.status === 'On Track' ? 'bg-primary/20 text-primary' :
                    'bg-amber-500/20 text-amber-500'
                  }`}>
                    {trial.status}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{trial.progress}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${trial.progress}%` }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compliance and Inventory */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Compliance */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-foreground">Compliance Status</h3>
          </div>
          <div className="space-y-3">
            {complianceItems.map((item) => (
              <div key={item.item} className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
                <div className="flex items-center gap-3">
                  {item.status === 'Compliant' ? (
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">{item.item}</p>
                    <p className="text-xs text-muted-foreground">Last audit: {item.lastAudit}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-foreground">{item.score}%</p>
                  <span className={`text-xs ${
                    item.status === 'Compliant' ? 'text-emerald-500' : 'text-amber-500'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Inventory Levels</h3>
          </div>
          <div className="space-y-4">
            {inventoryLevels.map((item) => (
              <div key={item.product} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{item.product}</p>
                  <p className="text-xs text-muted-foreground">Reorder at {item.reorderPoint}%</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-24 overflow-hidden rounded-full bg-secondary">
                    <div 
                      className={`h-full ${
                        item.level > 50 ? 'bg-emerald-500' : 
                        item.level > 30 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${item.level}%` }} 
                    />
                  </div>
                  <span className="w-12 text-right text-sm font-medium text-foreground">{item.level}%</span>
                  {item.status === 'Low' && (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-4 w-full gap-2">
            <Clock className="h-4 w-4" />
            Schedule Reorder
          </Button>
        </div>
      </div>
    </div>
  )
}
