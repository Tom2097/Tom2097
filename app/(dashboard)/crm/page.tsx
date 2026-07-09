import { redirect } from 'next/navigation'
import { Users, Target, Phone, Mail, FileText, Heart, BarChart3, Sparkles, Zap, AlertTriangle, MessageSquare, Copy, UserPlus, Sun, Globe, DollarSign, TrendingUp as TrendingUpIcon, Layers, Ticket, RefreshCw, BarChart2, MessageCircle, Brain, Activity } from 'lucide-react'
import { MetricCard, MetricGrid } from '@/components/digit/metric-card'
import { ChartContainer } from '@/components/digit/live-chart'
import { LiveChart } from '@/components/digit/live-chart'
import { RealTimeChart } from '@/components/digit/real-time-chart'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { CrmSupportTickets } from '@/components/digit/crm-support-tickets'
import { CrmSalesAnalytics } from '@/components/digit/crm-sales-analytics'
import { extractTenantContext } from '@/lib/multitenant/context.server'
import { getPipelineSummary, listContacts, getPipelineSummaryRealtime } from '@/lib/crm/engine'
import { detectAnomalies } from '@/lib/analytics/anomaly-detection'
import { forecastMetric } from '@/lib/analytics/forecasting'
import { getTranslator } from '@/lib/i18n/server'
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
  const { t } = await getTranslator()
  const ctx = await extractTenantContext()
  if (!ctx) redirect('/auth/login')
  const orgId = ctx.organizationId

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [pipeline, pipelineRealtime, anomalies, forecast, contactsResult] = await Promise.all([
    getPipelineSummary(orgId),
    getPipelineSummaryRealtime(orgId),
    detectAnomalies(orgId, 'crm_deal_value', { start: thirtyDaysAgo.toISOString(), end: now.toISOString() }),
    forecastMetric(orgId, 'crm_deal_value', 6),
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
            <h1 className="text-2xl font-bold text-foreground">{t("crm.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("crm.page.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CrmContactsManager initialContacts={initialContacts} />
        </div>
      </div>

       <div className="flex items-center justify-between mb-6">
         <div>
           <h2 className="text-2xl font-bold text-foreground">{t("crm.page.intelligenceTitle")}</h2>
           <p className="text-sm text-muted-foreground">{t("crm.page.intelligenceSubtitle")}</p>
         </div>
         <Button variant="ghost" size="sm" className="gap-1 text-sm">
           <RefreshCw className="h-3 w-3" />
           {t("crm.page.refresh")}
         </Button>
       </div>

       {/* Metrics */}
       <MetricGrid columns={4}>
         <MetricCard label={t("crm.page.totalContacts")} value={contactsResult.total} variant="highlight" />
         <MetricCard label={t("crm.page.openDeals")} value={pipeline.open_deals} />
         <MetricCard label={t("crm.page.pipelineValue")} value={formatCurrency(pipeline.total_open_value, pipeline.currency)} />
         <MetricCard label={t("crm.page.avgDealSize")} value={formatCurrency(avgDealValue, pipeline.currency)} />
         <MetricCard label={t("crm.page.winRate")} value={(() => { const won = pipeline.stages.find(s => s.stage === 'won')?.count ?? 0; const lost = pipeline.stages.find(s => s.stage === 'lost')?.count ?? 0; const total = won + lost; return total > 0 ? `${Math.round((won / total) * 100)}%` : '0%' })()} />
         <MetricCard label={t("crm.page.anomalies")} value={anomalies.anomalies.length} subtitle={t("crm.page.last30Days")} />
         <MetricCard label={t("crm.page.forecastGrowth")} value={forecast && forecast.length >= 2 ? `${Math.round(((forecast[forecast.length - 1].forecast - (forecast[0].actual || 0)) / ((forecast[0].actual || 1))) * 100)}%` : '0%'} subtitle={t("crm.page.next6Months")} />
          <MetricCard label={t("crm.page.whatsappIntegration")} value={pipelineRealtime.whatsappConnected ? t("crm.page.connected") : t("crm.page.disconnected")} variant={pipelineRealtime.whatsappConnected ? 'highlight' : 'glass'} />
       </MetricGrid>

       {/* Real-Time Pipeline Charts */}
       <div className="grid gap-6 lg:grid-cols-2">
           <ChartContainer title={t("crm.page.salesPipeline")}>
            {hasPipeline ? (
              <RealTimeChart
                data={pipelineData}
                dataKey="value"
                type="bar"
                height={280}
                anomalies={anomalies.anomalies}
              />
            ) : (
              <div className="flex h-[280px] items-center justify-center text-center text-sm text-muted-foreground">
                {t("crm.page.noDealsYet")}
              </div>
            )}
          </ChartContainer>

           <ChartContainer title={t("crm.page.pipelineHealth")}>
            <div className="grid grid-cols-2 gap-4 h-[280px]">
              <div className="rounded-xl border border-border/50 bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{t("crm.page.dealVelocity")}</h4>
                  <TrendingUpIcon className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold">{pipelineRealtime.dealVelocity.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">{t("crm.page.dealsPerWeek")}</p>
               <div className="mt-4 h-20 flex items-end gap-1">
                 {pipelineRealtime.velocityTrend.map((value, index) => (
                   <div key={index} className="flex-1 bg-blue-500/20 rounded-t-sm" style={{ height: `${value * 50}px` }}></div>
                 ))}
               </div>
             </div>

              <div className="rounded-xl border border-border/50 bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{t("crm.page.leadScoring")}</h4>
                  <Brain className="h-4 w-4 text-purple-500" />
                </div>
                <div className="text-2xl font-bold">{pipelineRealtime.avgLeadScore.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">{t("crm.page.avgScore")}</p>
               <div className="mt-4 h-20 flex items-end gap-1">
                 {pipelineRealtime.leadScoreDistribution.map((value, index) => (
                   <div key={index} className="flex-1 bg-purple-500/20 rounded-t-sm" style={{ height: `${value * 100}px` }}></div>
                 ))}
               </div>
             </div>

             <div className="rounded-xl border border-border/50 bg-card p-4">
               <div className="flex items-center justify-between mb-2">
                 <h4 className="text-sm font-medium">WhatsApp Activity</h4>
                 <MessageCircle className="h-4 w-4 text-green-500" />
               </div>
               <div className="text-2xl font-bold">{pipelineRealtime.whatsappConnected ? pipelineRealtime.dealVelocity || 0 : 0}</div>
               <p className="text-xs text-muted-foreground">messages/day</p>
               <div className="mt-4 h-16 flex items-center justify-center">
                 {pipelineRealtime.whatsappConnected ? (
                   <div className="flex items-center gap-2 text-green-500">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                     <span className="text-xs">Connected</span>
                   </div>
                 ) : (
                   <div className="flex items-center gap-2 text-red-500">
                     <div className="w-2 h-2 rounded-full bg-red-500"></div>
                     <span className="text-xs">Disconnected</span>
                   </div>
                 )}
               </div>
             </div>

             <div className="rounded-xl border border-border/50 bg-card p-4">
               <div className="flex items-center justify-between mb-2">
                 <h4 className="text-sm font-medium">AI Recommendations</h4>
                 <Activity className="h-4 w-4 text-orange-500" />
               </div>
               <div className="text-2xl font-bold">{pipelineRealtime.aiRecommendations}</div>
               <p className="text-xs text-muted-foreground">actions pending</p>
               <div className="mt-4 h-16 flex items-center justify-center">
                 <div className="flex items-center gap-2 text-orange-500">
                   <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                   <span className="text-xs">AI Active</span>
                 </div>
               </div>
             </div>
           </div>
         </ChartContainer>
       </div>

       {/* Pipeline Breakdown with Anomalies */}
       <div className="rounded-2xl border border-border/50 bg-card p-6">
         <h3 className="mb-4 text-lg font-semibold text-foreground flex items-center gap-2">
           Pipeline Breakdown
           {anomalies.anomalies.length > 0 && (
             <Badge variant="destructive" className="gap-1 text-xs">
               <AlertTriangle className="h-3 w-3" />
               {anomalies.anomalies.length} anomalies
             </Badge>
           )}
         </h3>
         {hasPipeline ? (
           <div className="space-y-3">
             {pipeline.stages
               .filter((s) => s.count > 0)
               .map((s) => {
                 const stageAnomalies = anomalies.anomalies.filter(a => a.dimensionValue === s.stage)
                 return (
                   <div key={s.stage} className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
                     <div>
                       <p className="font-medium capitalize text-foreground">{s.stage}</p>
                       <p className="text-sm text-muted-foreground">
                         {s.count} {s.count === 1 ? 'deal' : 'deals'} · weighted {formatCurrency(s.weighted_value, pipeline.currency)}
                       </p>
                       {stageAnomalies.length > 0 && (
                         <div className="flex items-center gap-1 mt-1">
                           {stageAnomalies.slice(0, 3).map((anomaly, index) => (
                             <div key={index} className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                           ))}
                           {stageAnomalies.length > 3 && (
                             <span className="text-xs text-muted-foreground">+{stageAnomalies.length - 3}</span>
                           )}
                         </div>
                       )}
                     </div>
                     <span className="text-sm font-medium text-foreground">
                       {formatCurrency(s.value, pipeline.currency)}
                     </span>
                   </div>
                 )
               })}
           </div>
         ) : (
           <div className="flex h-[200px] items-center justify-center text-center text-sm text-muted-foreground">
             Pipeline insights will appear once deals are added.
           </div>
         )}
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
        <div className="relative">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap gap-0.5 [&>button]:px-2 [&>button]:py-1 [&>button]:text-[11px]">
            <TabsTrigger value="ai-sdr" className="gap-0.5"><Sparkles className="w-3 h-3" /> {t("crm.tabs.ai")}</TabsTrigger>
            <TabsTrigger value="next-best-action" className="gap-0.5"><Zap className="w-3 h-3" /> {t("crm.tabs.actions")}</TabsTrigger>
            <TabsTrigger value="deal-health" className="gap-0.5"><AlertTriangle className="w-3 h-3" /> {t("crm.tabs.health")}</TabsTrigger>
            <TabsTrigger value="conversations" className="gap-0.5"><MessageSquare className="w-3 h-3" /> {t("crm.tabs.talk")}</TabsTrigger>
            <TabsTrigger value="duplicates" className="gap-0.5"><Copy className="w-3 h-3" /> {t("crm.tabs.duplicates")}</TabsTrigger>
            <TabsTrigger value="leads" className="gap-0.5"><BarChart3 className="w-3 h-3" /> {t("crm.tabs.leads")}</TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-0.5"><Target className="w-3 h-3" /> {t("crm.tabs.pipeline")}</TabsTrigger>
            <TabsTrigger value="quotes" className="gap-0.5"><FileText className="w-3 h-3" /> {t("crm.tabs.quotes")}</TabsTrigger>
            <TabsTrigger value="contacts" className="gap-0.5"><Users className="w-3 h-3" /> {t("crm.tabs.people")}</TabsTrigger>
            <TabsTrigger value="hierarchy" className="gap-0.5"><Users className="w-3 h-3" /> {t("crm.tabs.organizations")}</TabsTrigger>
            <TabsTrigger value="nurture" className="gap-0.5"><MessageSquare className="w-3 h-3" /> {t("crm.tabs.nurture")}</TabsTrigger>
            <TabsTrigger value="forecast" className="gap-0.5"><BarChart3 className="w-3 h-3" /> {t("crm.tabs.forecast")}</TabsTrigger>
            <TabsTrigger value="events" className="gap-0.5"><Layers className="w-3 h-3" /> {t("crm.tabs.events")}</TabsTrigger>
            <TabsTrigger value="briefing" className="gap-0.5"><Sun className="w-3 h-3" /> {t("crm.tabs.daily")}</TabsTrigger>
            <TabsTrigger value="vertical-signals" className="gap-0.5"><TrendingUpIcon className="w-3 h-3" /> {t("crm.tabs.markets")}</TabsTrigger>
            <TabsTrigger value="lead-roi" className="gap-0.5"><DollarSign className="w-3 h-3" /> {t("crm.tabs.roi")}</TabsTrigger>
            <TabsTrigger value="communications" className="gap-0.5"><Mail className="w-3 h-3" /> {t("crm.tabs.communications")}</TabsTrigger>
            <TabsTrigger value="tasks" className="gap-0.5"><Target className="w-3 h-3" /> {t("crm.tabs.tasks")}</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-0.5"><Phone className="w-3 h-3" /> {t("crm.tabs.timeline")}</TabsTrigger>
            <TabsTrigger value="success" className="gap-0.5"><Heart className="w-3 h-3" /> {t("crm.tabs.customerSuccess")}</TabsTrigger>
            <TabsTrigger value="support" className="gap-0.5"><Ticket className="w-3 h-3" /> {t("crm.tabs.tickets")}</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-0.5"><Target className="w-3 h-3" /> {t("crm.tabs.analytics")}</TabsTrigger>
          </TabsList>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>

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
        
        <TabsContent value="support" className="mt-4">
          <CrmSupportTickets />
        </TabsContent>
        
        <TabsContent value="analytics" className="mt-4">
          <CrmSalesAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  )
}
