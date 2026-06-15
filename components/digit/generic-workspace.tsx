'use client'

import { useState } from 'react'
import { LayoutGrid, Activity, FileText, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ChartContainer, LiveChart } from '@/components/digit/live-chart'
import { generateTimeSeriesData, generateOperationalMetrics } from '@/lib/mock-data'

const operationalStreams = [
  { name: 'Data Pipelines', detail: 'Ingestion and sync jobs', status: 'Healthy' },
  { name: 'Automation Runs', detail: 'Scheduled workflow executions', status: 'Healthy' },
  { name: 'Reporting Jobs', detail: 'Generated operational reports', status: 'Running' },
  { name: 'Integration Sync', detail: 'Connected service deliveries', status: 'Healthy' },
]

/**
 * Generic operational workspace used by configurable modules.
 * DigiT is an industry-agnostic platform — this view presents neutral
 * operational intelligence rather than any vertical-specific framing.
 */
export function GenericWorkspace({ title = 'Operations Workspace' }: { title?: string }) {
  const [throughputData] = useState(
    generateTimeSeriesData(30, 85, 12).map((d, i) => ({ name: i + 1, value: d.value })),
  )
  const [performanceData] = useState(generateOperationalMetrics())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">
              Configurable operational intelligence for your organization
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            View Reports
          </Button>
          <Button className="gap-2">
            <Workflow className="h-4 w-4" />
            Configure Workspace
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <MetricGrid columns={4}>
        <MetricCard label="Active Operations" value="184" subtitle="Running workflows" variant="highlight" />
        <MetricCard label="Throughput" value="94.2%" change={2.1} trend="up" />
        <MetricCard label="SLA Compliance" value="99.4%" subtitle="Rolling 30 days" change={0.6} trend="up" />
        <MetricCard label="Avg. Response" value="12ms" change={-4} trend="down" />
      </MetricGrid>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer title="Throughput" subtitle="30-day operational throughput (%)">
          <LiveChart data={throughputData} dataKey="value" type="line" height={280} color="hsl(var(--primary))" />
        </ChartContainer>

        <ChartContainer title="System Performance" subtitle="24-hour performance metrics">
          <LiveChart data={performanceData} dataKey="value" type="area" height={280} />
        </ChartContainer>
      </div>

      {/* Operational streams */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Operational Streams</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {operationalStreams.map((stream) => (
            <div key={stream.name} className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
              <div>
                <p className="font-medium text-foreground">{stream.name}</p>
                <p className="text-xs text-muted-foreground">{stream.detail}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  stream.status === 'Running'
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'bg-emerald-500/20 text-emerald-500'
                }`}
              >
                {stream.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
