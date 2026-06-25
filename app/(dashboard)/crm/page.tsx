import { redirect } from 'next/navigation'
import { Users, Target, Phone, Mail, FileText, Heart, BarChart3, Sparkles, Zap, AlertTriangle, MessageSquare, Copy, UserPlus, Sun, Globe, DollarSign, TrendingUp as TrendingUpIcon, Layers } from 'lucide-react'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ChartContainer, LiveChart } from '@/components/digit/live-chart'
import { CrmContactsManager, type CrmContactRow } from '@/components/digit/crm-contacts-manager'
import { CrmLeadInbox } from '@/components/digit/crm-lead-inbox'
import { CrmTimeline } from '@/components/digit/crm-timeline'
import { CrmTasks } from '@/components/digit/crm-tasks'
import { CrmCommunicationHub } from '@/components/digit/crm-communication-hub'
import { CrmQuotes } from '@/components/digit/crm-quotes'
import { CrmCustomerSuccess } from '@/components/digit/crm-customer-success'
import { CrmAiSdr } from '@/components/digit/crm-ai-sdr'
import { CrmNextBestAction } from '@/components/digit/crm-next-best-action'
import { CrmDealHealthRadar } from '@/components/digit/crm-deal-health'
import { CrmAskYourCrm } from '@/components/digit/crm-ask-your-crm'
import { CrmDuplicateDetection } from '@/components/digit/crm-duplicate-detection'
import { CrmConversationIntelligence } from '@/components/digit/crm-conversation-intelligence'
import { CrmAutoProvision } from '@/components/digit/crm-auto-provision'
import { CrmWhatsAppNurture } from '@/components/digit/crm-whatsapp-nurture'
import { CrmVerticalSignals } from '@/components/digit/crm-vertical-signals'
import { CrmLeadSourceRoi } from '@/components/digit/crm-lead-source-roi'
import { CrmFoundersBriefing } from '@/components/digit/crm-founders-briefing'
import { CrmEventInstrumentation } from '@/components/digit/crm-event-instrumentation'
import { CrmPipelineBoard } from '@/components/digit/crm-pipeline-board'
import { CrmAccountsHierarchy } from '@/components/digit/crm-accounts-hierarchy'
import { CrmForecastReports } from '@/components/digit/crm-forecast-reports'
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
      <MetricGrid columns={4}>
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

      {/* Smart CRM Intelligence Section */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="p-4 rounded-2xl border border-border/50 bg-card">
          <CrmAiSdr />
        </div>
        <div className="p-4 rounded-2xl border border-border/50 bg-card">
          <CrmNextBestAction />
        </div>
        <div className="p-4 rounded-2xl border border-border/50 bg-card">
          <CrmDealHealthRadar />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CrmAskYourCrm />
        <CrmAutoProvision />
      </div>

      {/* All CRM Tabs */}
      <Tabs defaultValue="ai-sdr" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="ai-sdr" className="gap-1"><Sparkles className="w-4 h-4" /> AI SDR</TabsTrigger>
          <TabsTrigger value="next-best-action" className="gap-1"><Zap className="w-4 h-4" /> Next Actions</TabsTrigger>
          <TabsTrigger value="deal-health" className="gap-1"><AlertTriangle className="w-4 h-4" /> Deal Health</TabsTrigger>
          <TabsTrigger value="conversations" className="gap-1"><MessageSquare className="w-4 h-4" /> Conversations</TabsTrigger>
          <TabsTrigger value="duplicates" className="gap-1"><Copy className="w-4 h-4" /> Duplicates</TabsTrigger>
          <TabsTrigger value="leads" className="gap-1"><BarChart3 className="w-4 h-4" /> Lead Inbox</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1"><Users className="w-4 h-4" /> Contacts</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1"><Phone className="w-4 h-4" /> Timeline</TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1"><Target className="w-4 h-4" /> Tasks</TabsTrigger>
          <TabsTrigger value="communications" className="gap-1"><Mail className="w-4 h-4" /> Comm</TabsTrigger>
          <TabsTrigger value="quotes" className="gap-1"><FileText className="w-4 h-4" /> Quotes</TabsTrigger>
          <TabsTrigger value="success" className="gap-1"><Heart className="w-4 h-4" /> CS</TabsTrigger>
          <TabsTrigger value="nurture" className="gap-1"><MessageSquare className="w-4 h-4" /> Nurture</TabsTrigger>
          <TabsTrigger value="vertical-signals" className="gap-1"><TrendingUpIcon className="w-4 h-4" /> Signals</TabsTrigger>
          <TabsTrigger value="lead-roi" className="gap-1"><DollarSign className="w-4 h-4" /> Lead ROI</TabsTrigger>
          <TabsTrigger value="briefing" className="gap-1"><Sun className="w-4 h-4" /> Briefing</TabsTrigger>
          <TabsTrigger value="events" className="gap-1"><Layers className="w-4 h-4" /> Events</TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1"><Target className="w-4 h-4" /> Pipeline</TabsTrigger>
          <TabsTrigger value="hierarchy" className="gap-1"><Users className="w-4 h-4" /> Hierarchy</TabsTrigger>
          <TabsTrigger value="forecast" className="gap-1"><BarChart3 className="w-4 h-4" /> Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="ai-sdr" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmAiSdr />
          </div>
        </TabsContent>

        <TabsContent value="next-best-action" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmNextBestAction />
          </div>
        </TabsContent>

        <TabsContent value="deal-health" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmDealHealthRadar />
          </div>
        </TabsContent>

        <TabsContent value="conversations" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmConversationIntelligence />
          </div>
        </TabsContent>

        <TabsContent value="duplicates" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmDuplicateDetection />
          </div>
        </TabsContent>

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

        <TabsContent value="nurture" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmWhatsAppNurture />
          </div>
        </TabsContent>

        <TabsContent value="vertical-signals" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmVerticalSignals />
          </div>
        </TabsContent>

        <TabsContent value="lead-roi" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmLeadSourceRoi />
          </div>
        </TabsContent>

        <TabsContent value="briefing" className="mt-4">
          <CrmFoundersBriefing />
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <CrmEventInstrumentation />
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmPipelineBoard />
          </div>
        </TabsContent>

        <TabsContent value="hierarchy" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmAccountsHierarchy />
          </div>
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <CrmForecastReports />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
