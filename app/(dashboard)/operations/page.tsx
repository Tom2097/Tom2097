"use client"

import { useState, useEffect } from "react"
import { useI18n } from "@/components/providers/i18n-provider"
import { UniversalIntake } from "@/components/digit/universal-intake"
import { DocumentFeed } from "@/components/digit/document-feed"
import { SplitView } from "@/components/digit/split-view"
import { CompareView } from "@/components/digit/compare-view"
import { OperationalCopilot } from "@/components/digit/operational-copilot"
import { VerticalIntelligence } from "@/components/digit/vertical-intelligence"
import { VerticalRecipes } from "@/components/digit/vertical-recipes"
import { CommandPalette } from "@/components/digit/command-palette"
import { OperationalReports } from "@/components/digit/operational-reports"
import { RealTimeChart } from "@/components/digit/real-time-chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Inbox, Beaker, BookTemplate, Columns, ArrowLeftRight, Brain, FileSearch, MessageSquare, Sparkles, ListTree, Zap, FileText, BarChart2, RefreshCw, AlertTriangle, MessageCircle, Users, Activity, Mail } from "lucide-react"

const sampleDocuments = [
  { id: "doc-1", name: "Invoice_Acme_2024.pdf", content: "INVOICE #INV-001\nDate: 2024-01-15\nVendor: Acme Corp\nTotal: $12,500.00\nItems:\n  - Widget A x 50: $5,000\n  - Widget B x 30: $7,500" },
  { id: "doc-2", name: "Contract_ABC_License.pdf", content: "SOFTWARE LICENSE AGREEMENT\nParty: ABC Software Inc.\nTerm: 12 months\nFee: $24,000/year\nAuto-renew: Yes\nGoverning Law: Delaware" },
  { id: "doc-3", name: "Inspection_Report_Q1.pdf", content: "INSPECTION REPORT\nFacility: Plant 7\nDate: 2024-03-01\nInspector: J. Smith\nFindings: 3 minor, 1 major\nCorrective actions: Pending" },
]

export default function OperationsPage() {
  const { t } = useI18n()
  const [selectedDoc, setSelectedDoc] = useState<{ id: string; name: string; content?: string; extracted_entities?: Record<string, unknown> } | null>(null)
  const [feedItems, setFeedItems] = useState<Array<{ id: string; name: string; content?: string; extracted_entities?: Record<string, unknown> }>>([])
  const [metrics, setMetrics] = useState({
    ingestionRate: 0,
    processingTime: 0,
    analysisSuccessRate: 0,
    autoActionRate: 0,
    openCapas: 0,
    whatsappMessages: 0,
    emailMessages: 0,
  })
  const [chartData, setChartData] = useState<Array<{ name: string; value: number }>>([])
  const [anomalies, setAnomalies] = useState<Array<{ id: string; type: string; severity: string; timestamp: string }>>([])

  const handleSelectDoc = (doc: { id: string; name: string; content?: string; extracted_entities?: Record<string, unknown> }) => {
    setSelectedDoc(doc)
    setFeedItems((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev
      return [...prev, doc]
    })
  }

  useEffect(() => {
    let mounted = true

    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/v1/operations/metrics')
        if (!res.ok || !mounted) return
        const data = await res.json()
        setMetrics({
          ingestionRate: data.ingestionRate ?? 0,
          processingTime: data.processingTime ?? 0,
          analysisSuccessRate: data.analysisSuccessRate ?? 0,
          autoActionRate: data.autoActionRate ?? 0,
          openCapas: data.openCapas ?? 0,
          whatsappMessages: data.whatsappMessages ?? 0,
          emailMessages: data.emailMessages ?? 0,
        })
        setChartData(data.chartData ?? [])
        setAnomalies(data.anomalies ?? [])
      } catch {
        // Non-fatal -- tiles just keep their last known values.
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 15000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-500">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("operations.page.title")}</h1>
            <p className="text-sm text-muted-foreground">Unified intake hub — ingest, understand, act, and review</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1 text-sm">
            <RefreshCw className="h-3 w-3" />
            {t("operations.page.refresh")}
          </Button>
          <CommandPalette />
        </div>
      </div>

      {/* Real-Time Metrics */}
      <div className="grid gap-6 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("operations.page.documentIngestion")}</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.ingestionRate}/min</div>
            <p className="text-xs text-muted-foreground">Documents processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Time</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.processingTime}ms</div>
            <p className="text-xs text-muted-foreground">Avg processing time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analysis Success Rate</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.analysisSuccessRate}%</div>
            <p className="text-xs text-muted-foreground">Documents analyzed without error</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Action Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.autoActionRate}%</div>
            <p className="text-xs text-muted-foreground">Classified docs with a task created</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("operations.page.realTimeProcessing")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ErrorBoundary>
              <RealTimeChart
                data={chartData}
                dataKey="value"
                type="line"
                height={280}
              />
            </ErrorBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t("operations.page.operationalStatus")}</span>
              {anomalies.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {anomalies.length} alerts
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium">{t("operations.page.whatsappMessages")}</div>
                    <div className="text-sm text-muted-foreground">{metrics.whatsappMessages} {t("operations.page.messagesToday")}</div>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="font-medium">{t("operations.page.emailMessages")}</div>
                    <div className="text-sm text-muted-foreground">{metrics.emailMessages} {t("operations.page.emailsToday")}</div>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-purple-500" />
                  <div>
                    <div className="font-medium">Open CAPAs</div>
                    <div className="text-sm text-muted-foreground">{metrics.openCapas} awaiting resolution</div>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
              </div>
            </div>

            {anomalies.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border/50">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  {t("operations.page.anomalies")}
                </h4>
                <div className="space-y-2 text-xs">
                  {anomalies.slice(-3).map((anomaly) => (
                    <div key={anomaly.id} className="flex items-center justify-between p-2 rounded-lg bg-destructive/10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <div>
                          <div className="font-medium">{anomaly.type.replace('_', ' ')}</div>
                          <div className="text-muted-foreground">{new Date(anomaly.timestamp).toLocaleTimeString()}</div>
                        </div>
                      </div>
                      <Badge variant={anomaly.severity === 'high' ? 'destructive' : anomaly.severity === 'medium' ? 'default' : 'secondary'} className="text-xs">
                        {anomaly.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <UniversalIntake />

          <Tabs defaultValue="feed">
            <TabsList>
              <TabsTrigger value="feed"><Inbox className="h-4 w-4 mr-1" />{t("operations.page.documentFeed")}</TabsTrigger>
              <TabsTrigger value="split"><Columns className="h-4 w-4 mr-1" />{t("operations.page.splitView")}</TabsTrigger>
              <TabsTrigger value="compare"><ArrowLeftRight className="h-4 w-4 mr-1" />{t("operations.page.compare")}</TabsTrigger>
            <TabsTrigger value="intelligence"><Beaker className="h-4 w-4 mr-1" />{t("operations.page.verticalIntelligence")}</TabsTrigger>
            <TabsTrigger value="recipes"><BookTemplate className="h-4 w-4 mr-1" />{t("operations.page.recipes")}</TabsTrigger>
            <TabsTrigger value="reports"><BarChart2 className="h-4 w-4 mr-1" />{t("operations.page.operationalReports")}</TabsTrigger>
          </TabsList>

            <TabsContent value="feed" className="mt-4">
              <div className="grid grid-cols-1 gap-4">
                <DocumentFeed onSelectDoc={handleSelectDoc} />
              </div>
            </TabsContent>

            <TabsContent value="split" className="mt-4">
              <div className="h-[60vh]">
                <SplitView document={selectedDoc} />
              </div>
            </TabsContent>

            <TabsContent value="compare" className="mt-4">
              <CompareView documents={feedItems.length > 0 ? feedItems : sampleDocuments} />
            </TabsContent>

            <TabsContent value="intelligence" className="mt-4">
              <VerticalIntelligence />
            </TabsContent>

            <TabsContent value="recipes" className="mt-4">
              <VerticalRecipes />
            </TabsContent>
            
            <TabsContent value="reports" className="mt-4">
              <OperationalReports />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Brain className="h-4 w-4 text-indigo-500" />
                {t("operations.page.understandingLayer")}
              </CardTitle>
              <CardDescription className="text-xs">{t("operations.page.aiClassification")}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium">{t("operations.page.classification")}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">Auto</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-medium">{t("operations.page.fieldExtraction")}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">Invoice, Contract, +3</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs font-medium">{t("operations.page.summarization")}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">Key Points</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium">{t("operations.page.entityRecognition")}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">People, Orgs, Dates</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ListTree className="h-4 w-4 text-amber-500" />
                {t("operations.page.actionLayer")}
              </CardTitle>
              <CardDescription className="text-xs">{t("operations.page.autoCreateTasks")}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                <div className="flex items-center gap-2">
                  <ListTree className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs font-medium">{t("operations.page.autoTasks")}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">CAPA, Payables</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium">{t("operations.page.draftResponse")}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">AI-Powered</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-xs font-medium">{t("operations.page.recipeExecution")}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">4 Playbooks</Badge>
              </div>
            </CardContent>
          </Card>

          <OperationalCopilot />
        </div>
      </div>
    </div>
  )
}
