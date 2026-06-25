import { redirect } from 'next/navigation'
import { Users, Target, Phone, Mail, FileText, Heart, BarChart3 } from 'lucide-react'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ChartContainer, LiveChart } from '@/components/digit/live-chart'
import { CrmContactsManager, type CrmContactRow } from '@/components/digit/crm-contacts-manager'
import { CrmLeadInbox } from '@/components/digit/crm-lead-inbox'
import { CrmTimeline } from '@/components/digit/crm-timeline'
import { CrmTasks } from '@/components/digit/crm-tasks'
import { CrmCommunicationHub } from '@/components/digit/crm-communication-hub'
import { CrmQuotes } from '@/components/digit/crm-quotes'
import { CrmCustomerSuccess } from '@/components/digit/crm-customer-success'
import { extractTenantContext } from '@/lib/multitenant/context'
import { getPipelineSummary, listContacts } from '@/lib/crm/engine'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

  const avgDealValue = pipeline.open_deals > 0 ? pipeline.total_open_value / pipeline.open_deals : 0

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
        <div className="flex items-center gap-2">
          <CrmContactsManager initialContacts={initialContacts} />
        </div>
      </div>

      {/* Metrics */}
      <MetricGrid columns={5}>
        <MetricCard label="Total Contacts" value={contactsResult.total} variant="highlight" />
        <MetricCard label="Open Deals" value={pipeline.open_deals} />
        <MetricCard label="Pipeline Value" value={formatCurrency(pipeline.total_open_value, pipeline.currency)} />
        <MetricCard label="Avg Deal Size" value={formatCurrency(avgDealValue, pipeline.currency)} />
        <MetricCard label="Win Rate" value={pipeline.stages.find(s => s.stage === 'won')?.count ? `${Math.round(pipeline.stages.find(s => s.stage === 'won')!.count / Math.max(1, pipeline.open_deals + pipeline.stages.find(s => s.stage === 'won')!.count) * 100)}%` : '0%'} />
      </MetricGrid>

      {/* Pipeline Chart */}
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

      {/* All CRM Tabs */}
      <Tabs defaultValue="leads" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="leads" className="gap-1"><BarChart3 className="w-4 h-4" /> Lead Inbox</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1"><Users className="w-4 h-4" /> Contacts</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1"><Phone className="w-4 h-4" /> Timeline</TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1"><Target className="w-4 h-4" /> Tasks</TabsTrigger>
          <TabsTrigger value="communications" className="gap-1"><Mail className="w-4 h-4" /> Communications</TabsTrigger>
          <TabsTrigger value="quotes" className="gap-1"><FileText className="w-4 h-4" /> Quotes</TabsTrigger>
          <TabsTrigger value="success" className="gap-1"><Heart className="w-4 h-4" /> Customer Success</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmLeadInbox />
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <CrmContactsManager initialContacts={initialContacts} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmTimeline />
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmTasks />
          </div>
        </TabsContent>

        <TabsContent value="communications" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmCommunicationHub />
          </div>
        </TabsContent>

        <TabsContent value="quotes" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmQuotes />
          </div>
        </TabsContent>

        <TabsContent value="success" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmCustomerSuccess />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
