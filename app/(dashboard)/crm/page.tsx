import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ChartContainer, LiveChart } from '@/components/digit/live-chart'
import { CrmContactsManager, type CrmContactRow } from '@/components/digit/crm-contacts-manager'
import { extractTenantContext } from '@/lib/multitenant/context'
import { getPipelineSummary, listContacts } from '@/lib/crm/engine'

export const dynamic = 'force-dynamic'

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      notation: value >= 10000 ? 'compact' : 'standard',
      maximumFractionDigits: 1,
    }).format(value)
  } catch {
    return `$${value.toLocaleString()}`
  }
}

export default async function CRMPage() {
  const ctx = await extractTenantContext()
  if (!ctx) redirect('/auth/login')
  const orgId = ctx.organizationId

  const [pipeline, contactsResult] = await Promise.all([
    getPipelineSummary(orgId),
    listContacts(orgId, { limit: 100 }),
  ])

  const pipelineData = pipeline.stages.map((s) => ({
    name: s.stage.charAt(0).toUpperCase() + s.stage.slice(1),
    value: Math.round(s.value),
  }))
  const hasPipeline = pipeline.stages.some((s) => s.count > 0)

  const initialContacts: CrmContactRow[] = contactsResult.contacts.map((c) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || 'Unnamed contact',
    email: c.email,
    phone: c.phone,
    title: c.title,
    status: c.status,
    company: null,
  }))

  const avgDealValue =
    pipeline.open_deals > 0 ? pipeline.total_open_value / pipeline.open_deals : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-2/20 text-chart-2">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Smart CRM</h1>
            <p className="text-sm text-muted-foreground">AI-driven customer management and engagement</p>
          </div>
        </div>

        <CrmContactsManager initialContacts={initialContacts} />
      </div>

      {/* Metrics */}
      <MetricGrid columns={4}>
        <MetricCard label="Total Contacts" value={contactsResult.total} variant="highlight" />
        <MetricCard label="Open Deals" value={pipeline.open_deals} />
        <MetricCard label="Pipeline Value" value={formatCurrency(pipeline.total_open_value, pipeline.currency)} />
        <MetricCard label="Avg Deal Size" value={formatCurrency(avgDealValue, pipeline.currency)} />
      </MetricGrid>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartContainer title="Sales Pipeline" subtitle="Deal value by stage">
          {hasPipeline ? (
            <LiveChart data={pipelineData} dataKey="value" type="bar" height={280} color="hsl(var(--chart-2))" />
          ) : (
            <div className="flex h-[280px] items-center justify-center text-center text-sm text-muted-foreground">
              No deals in the pipeline yet. Add a deal to see stage progression.
            </div>
          )}
        </ChartContainer>

        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Pipeline Breakdown</h3>
          {hasPipeline ? (
            <div className="space-y-3">
              {pipeline.stages
                .filter((s) => s.count > 0)
                .map((s) => (
                  <div key={s.stage} className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
                    <div>
                      <p className="font-medium capitalize text-foreground">{s.stage}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.count} {s.count === 1 ? 'deal' : 'deals'} · weighted {formatCurrency(s.weighted_value, pipeline.currency)}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrency(s.value, pipeline.currency)}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-center text-sm text-muted-foreground">
              Pipeline insights will appear once deals are added.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
