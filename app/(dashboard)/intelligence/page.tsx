"use client"

import { useState, useEffect } from "react"
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

export default function IntelligencePage() {
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
  const [chartData, setChartData] = useState<Array<{ name: string; value: number; insights: number }>>(() =>
    Array.from({ length: 10 }, (_, i) => ({
      name: `T-${10 - i}`,
      value: Math.floor(Math.random() * 30) + 40,
      insights: Math.floor(Math.random() * 5) + 3,
    }))
  )
  const [anomalies, setAnomalies] = useState<Array<{ id: string; type: string; severity: string; timestamp: string }>>([])

  useEffect(() => {
    // Simulate real-time data updates
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        reasoningAccuracy: Math.floor(Math.random() * 15) + 85,
        systemLoad: Number((Math.random() * 0.5 + 0.5).toFixed(2)),
        memoryUsage: Number((Math.random() * 0.3 + 0.6).toFixed(2)),
        activeAgents: Math.floor(Math.random() * 5) + 6,
        insightsGenerated: Math.floor(Math.random() * 50) + 120,
        anomalyDetection: Math.floor(Math.random() * 5),
      }))
      
      // Update chart data
      setChartData(prev => {
        const now = new Date()
        const newPoint = {
          name: now.toLocaleTimeString(),
          value: Math.floor(Math.random() * 50) + 50,
          insights: Math.floor(Math.random() * 10) + 5,
        }
        return [...prev.slice(-9), newPoint]
      })
      
      // Update anomalies
      if (Math.random() > 0.6) {
        setAnomalies(prev => {
          const now = new Date()
          const newAnomaly = {
            id: `anomaly-${Date.now()}`,
            type: ['reasoning_error', 'graph_fragmentation', 'agent_failure'][Math.floor(Math.random() * 3)],
            severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
            timestamp: now.toISOString(),
          }
          return [...prev.slice(-4), newAnomaly]
        })
      }
    }, 3000)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Intelligence</h1>
          <p className="text-muted-foreground">
            Real-time monitoring, causal reasoning, and autonomous agents
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-sm">
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {/* Intelligence Metrics */}
      <div className="grid gap-6 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent Status</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${metrics.agentStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <div className="text-2xl font-bold capitalize">{metrics.agentStatus}</div>
            </div>
            <p className="text-xs text-muted-foreground">{metrics.activeAgents} agents active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reasoning Accuracy</CardTitle>
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

      {/* Real-Time Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
         <ChartContainer title="Operational Graph Activity">
          <RealTimeChart
            data={chartData}
            dataKey="value"
            type="line"
            height={280}
          />
        </ChartContainer>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>System Status</span>
              {metrics.anomalyDetection > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {metrics.anomalyDetection} alerts
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
                    <div className="font-medium">Insights Generated</div>
                    <div className="text-sm text-muted-foreground">{metrics.insightsGenerated} today</div>
                  </div>
                </div>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <Network className="h-5 w-5 text-purple-500" />
                  <div>
                    <div className="font-medium">Graph Complexity</div>
                    <div className="text-sm text-muted-foreground">{metrics.graphComplexity} nodes</div>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
              </div>

              {anomalies.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Recent Anomalies
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
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="command-center" className="gap-2">
            <Brain className="w-4 h-4" />
            Command Center
          </TabsTrigger>
          <TabsTrigger value="industry" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Industry Hub
          </TabsTrigger>
          <TabsTrigger value="causal-chains" className="gap-2">
            <Network className="w-4 h-4" />
            Causal Chains
          </TabsTrigger>
          <TabsTrigger value="predictive" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Predictive Modeling
          </TabsTrigger>
        </TabsList>

        <TabsContent value="command-center" className="mt-4">
          <ErrorBoundary><IntelligenceCommandCenter /></ErrorBoundary>
        </TabsContent>

        <TabsContent value="industry" className="mt-4">
          <ErrorBoundary><IndustryIntelligenceHub /></ErrorBoundary>
        </TabsContent>

        <TabsContent value="causal-chains" className="mt-4">
          <ErrorBoundary><CausalChainView /></ErrorBoundary>
        </TabsContent>
          
        <TabsContent value="predictive" className="mt-4">
          <ErrorBoundary><PredictiveModeling /></ErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  )
}
