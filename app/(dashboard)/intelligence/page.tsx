"use client"

import { useState, useEffect, useCallback } from "react"
import { useI18n } from "@/components/providers/i18n-provider"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IntelligenceCommandCenter } from "@/components/digit/intelligence-command-center"
import { IndustryIntelligenceHub } from "@/components/digit/industry-intelligence-hub"
import { CausalChainView } from "@/components/digit/causal-chain-view"
import { PredictiveModeling } from "@/components/digit/predictive-modeling"
import { RealTimeChart } from "@/components/digit/real-time-chart"
import { ChartContainer } from "@/components/digit/live-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Brain, BarChart3, Network, Sparkles, RefreshCw, Activity, Cpu, MemoryStick, Zap, AlertTriangle, TrendingUp } from "lucide-react"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"

export default function IntelligencePage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState("command-center")
  const [metrics, setMetrics] = useState({
    agentStatus: "active",
    reasoningAccuracy: 92,
    graphComplexity: 42,
    anomalyDetection: 3,
    systemLoad: 0.75,
    memoryUsage: 0.68,
    activeAgents: 8,
    insightsGenerated: 142,
  })
  const [chartData, setChartData] = useState<Array<{ name: string; value: number; insights: number }>>([])
  const [anomalies, setAnomalies] = useState<Array<{ id: string; type: string; severity: string; timestamp: string }>>([])
  const [refreshing, setRefreshing] = useState(false)

  const fetchAggregate = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/intelligence/aggregate")
      if (!res.ok) return
      const data = await res.json()
      if (data.metrics) setMetrics(data.metrics)
      if (data.chartData) setChartData(data.chartData)
      if (data.anomalies) setAnomalies(data.anomalies)
    } catch {
      // Non-fatal -- tiles just keep their last known values.
    }
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchAggregate()
    /* eslint-enable react-hooks/set-state-in-effect */
    const interval = setInterval(fetchAggregate, 30000)
    return () => clearInterval(interval)
  }, [fetchAggregate])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAggregate()
    setRefreshing(false)
  }

  return (
    <ErrorBoundary>
    <div className="space-y-6">
      <AnimatedGroup className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-bold tracking-tight">{t("intelligence.page.title")}</h1>
           <p className="text-muted-foreground">
             {t("intelligence.page.subtitle")}
           </p>
        </div>
         <Button variant="ghost" size="sm" className="gap-1 text-sm" disabled={refreshing} onClick={handleRefresh}>
           <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
           {t("intelligence.page.refresh")}
         </Button>
      </div>

      {/* Intelligence Metrics */}
      <div className="grid gap-6 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">{t("intelligence.page.agentStatus")}</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${metrics.agentStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
               <div className="text-2xl font-bold capitalize">{t(`intelligence.page.${metrics.agentStatus}`)}</div>
             </div>
             <p className="text-xs text-muted-foreground">{metrics.activeAgents} {t("intelligence.page.agentsActive")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">{t("intelligence.page.reasoningAccuracy")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.reasoningAccuracy}%</div>
            <p className="text-xs text-muted-foreground">Causal reasoning accuracy</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Load</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(metrics.systemLoad * 100)}%</div>
            <p className="text-xs text-muted-foreground">CPU utilization</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(metrics.memoryUsage * 100)}%</div>
            <p className="text-xs text-muted-foreground">Memory utilization</p>
          </CardContent>
        </Card>
      </div>
      </AnimatedGroup>

      {/* Real-Time Charts */}
      <InView className="grid gap-6 lg:grid-cols-2">
        <ErrorBoundary>
           <ChartContainer title={t("intelligence.page.operationalGraphActivity")}>
            <RealTimeChart
              data={chartData}
              dataKey="value"
              type="line"
              height={280}
            />
          </ChartContainer>
        </ErrorBoundary>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
               <span>{t("intelligence.page.systemStatus")}</span>
              {metrics.anomalyDetection > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                   {metrics.anomalyDetection} {t("intelligence.page.alerts")}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-blue-500" />
                  <div>
                     <div className="font-medium">{t("intelligence.page.insightsGenerated")}</div>
                     <div className="text-sm text-muted-foreground">{metrics.insightsGenerated} {t("intelligence.page.today")}</div>
                  </div>
                </div>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <Network className="h-5 w-5 text-purple-500" />
                  <div>
                     <div className="font-medium">{t("intelligence.page.graphComplexity")}</div>
                     <div className="text-sm text-muted-foreground">{metrics.graphComplexity} {t("intelligence.page.nodes")}</div>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
              </div>

              {anomalies.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                   <h4 className="font-semibold mb-2 flex items-center gap-2">
                     <AlertTriangle className="h-4 w-4 text-red-500" />
                     {t("intelligence.page.recentAnomalies")}
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
            </div>
          </CardContent>
        </Card>
      </InView>

      <InView delay={0.08}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
           <TabsTrigger value="command-center" className="gap-2">
             <Brain className="w-4 h-4" />
             {t("intelligence.page.commandCenter")}
           </TabsTrigger>
           <TabsTrigger value="industry" className="gap-2">
             <BarChart3 className="w-4 h-4" />
             {t("intelligence.page.industryIntelligence")}
           </TabsTrigger>
           <TabsTrigger value="causal-chains" className="gap-2">
             <Network className="w-4 h-4" />
             {t("intelligence.page.causalChain")}
           </TabsTrigger>
           <TabsTrigger value="predictive" className="gap-2">
             <Sparkles className="w-4 h-4" />
             {t("intelligence.page.predictiveModeling")}
           </TabsTrigger>
        </TabsList>

        <TabsContent value="command-center" className="mt-4">
          <ErrorBoundary>
            <IntelligenceCommandCenter />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="industry" className="mt-4">
          <ErrorBoundary>
            <IndustryIntelligenceHub />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="causal-chains" className="mt-4">
          <ErrorBoundary>
            <CausalChainView />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="predictive" className="mt-4">
          <ErrorBoundary>
            <PredictiveModeling />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
      </InView>
    </div>
    </ErrorBoundary>
  )
}
