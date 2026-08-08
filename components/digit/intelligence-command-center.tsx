"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain,
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Bot,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  ChevronRight,
  FileText,
  Users,
  DollarSign,
  Network,
  PlayCircle,
  PauseCircle,
  CheckCircle,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface Finding {
  id: string
  type: string
  title: string
  description: string
  impactScore: number
  confidence: number
  status: string
  detectedAt: string
  sourceModule: string
  monetaryRisk: number
  suggestedAction: string | null
  requiresApproval: boolean
}

interface MonitorSummary {
  total: number
  warnings: number
  critical: number
  healthy: number
}

interface BriefingData {
  id: string
  date: string
  summary: string
  metrics?: Array<{ label: string; value: number; change: number; trend: string }>
  actionItems?: Array<{ id: string; title: string; description: string; priority: string; module: string }>
}

interface AgentAction {
  id: string
  agentId: string
  type: string
  targetEntity: string
  targetModule: string
  status: string
  config?: Record<string, unknown>
}

interface Agent {
  id: string
  name: string
  description: string
  isActive: boolean
}

export function IntelligenceCommandCenter() {
  const [findings, setFindings] = useState<Finding[]>([])
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [monitorSummary, setMonitorSummary] = useState<MonitorSummary | null>(null)
  const [pendingActions, setPendingActions] = useState<AgentAction[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRunningMonitors, setIsRunningMonitors] = useState(false)
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null)
  const [resolvingFinding, setResolvingFinding] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/intelligence/findings?limit=20&ranked=true").then((r) => r.ok ? r.json() : null),
      fetch("/api/v1/intelligence/actions").then((r) => r.ok ? r.json() : null),
      fetch("/api/v1/intelligence/briefing").then((r) => r.ok ? r.json() : null),
      fetch("/api/v1/intelligence/agents").then((r) => r.ok ? r.json() : null),
    ]).then(([findingsData, actionsData, briefingData, agentsData]) => {
      setFindings(findingsData?.findings || [])
      setPendingActions(actionsData?.actions || [])
      if (briefingData) setBriefing(briefingData)
      setAgents(Array.isArray(agentsData) ? agentsData : [])
      setIsLoading(false)
    }).catch(() => setIsLoading(false))
  }, [])

  const runMonitors = async () => {
    setIsRunningMonitors(true)
    try {
      const res = await fetch("/api/v1/intelligence/monitor", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setMonitorSummary(data.summary)
      }
    } finally {
      setIsRunningMonitors(false)
    }
  }

  const generateBriefing = async () => {
    setIsGeneratingBriefing(true)
    try {
      const res = await fetch("/api/v1/intelligence/briefing", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setBriefing(data)
      }
    } finally {
      setIsGeneratingBriefing(false)
    }
  }

  const autoAssign = async () => {
    try {
      await fetch("/api/v1/intelligence/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto-assign" }),
      })
      const [findingsRes, actionsRes] = await Promise.all([
        fetch("/api/v1/intelligence/findings?limit=20&ranked=true").then((r) => r.ok ? r.json() : null),
        fetch("/api/v1/intelligence/actions").then((r) => r.ok ? r.json() : null),
      ])
      if (findingsRes) setFindings(findingsRes.findings || [])
      if (actionsRes) setPendingActions(actionsRes.actions || [])
    } catch {
    }
  }

  const resolveFinding = async (findingId: string) => {
    setResolvingFinding(findingId)
    try {
      await fetch("/api/v1/intelligence/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: findingId }),
      })
      const [findingsRes, actionsRes] = await Promise.all([
        fetch("/api/v1/intelligence/findings?limit=20&ranked=true").then((r) => r.ok ? r.json() : null),
        fetch("/api/v1/intelligence/actions").then((r) => r.ok ? r.json() : null),
      ])
      if (findingsRes) setFindings(findingsRes.findings || [])
      if (actionsRes) setPendingActions(actionsRes.actions || [])
    } finally {
      setResolvingFinding(null)
    }
  }

  const approveAction = async (actionId: string) => {
    try {
      await fetch("/api/v1/intelligence/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", actionId }),
      })
      const actionsRes = await fetch("/api/v1/intelligence/actions").then((r) => r.ok ? r.json() : null)
      if (actionsRes) setPendingActions(actionsRes.actions || [])
    } catch {
    }
  }

  const moduleColors: Record<string, string> = {
    compliance: "text-red-500 bg-red-500/10 border-red-500/20",
    resources: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    crm: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    operations: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  }

  const severityColor = (risk: number) => {
    if (risk > 50000) return "text-red-500 bg-red-500/10 border-red-500/20"
    if (risk > 10000) return "text-amber-500 bg-amber-500/10 border-amber-500/20"
    return "text-green-500 bg-green-500/10 border-green-500/20"
  }

  return (
    <div className="space-y-6">
      {/* Brain Status Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-purple-500/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
                  <Brain className="w-7 h-7 text-primary" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  Command Center
                  <Badge variant="secondary" className="ml-2">
                    <Activity className="w-3 h-3 mr-1" />
                    {pendingActions.length > 0 ? `${pendingActions.length} pending` : "All clear"}
                  </Badge>
                </h2>
                <p className="text-sm text-muted-foreground">Continuous monitoring across all modules</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={runMonitors} disabled={isRunningMonitors} className="gap-2">
                <RefreshCw className={cn("w-4 h-4", isRunningMonitors && "animate-spin")} />
                {isRunningMonitors ? "Scanning..." : "Run Scan"}
              </Button>
              <Button variant="outline" size="sm" onClick={generateBriefing} disabled={isGeneratingBriefing} className="gap-2">
                <Sparkles className={cn("w-4 h-4", isGeneratingBriefing && "animate-pulse")} />
                Generate Briefing
              </Button>
              <Button variant="default" size="sm" onClick={autoAssign} className="gap-2">
                <PlayCircle className="w-4 h-4" />
                Auto-Assign Agents
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Metrics */}
      {monitorSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-500">{monitorSummary.healthy}</p>
              <p className="text-xs text-muted-foreground">Healthy</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-500">{monitorSummary.warnings}</p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{monitorSummary.critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{findings.length}</p>
              <p className="text-xs text-muted-foreground">Active Findings</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="gap-2">
            <Brain className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="findings" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Findings
            {findings.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                {findings.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-2">
            <Zap className="w-4 h-4" />
            Actions
            {pendingActions.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs">
                {pendingActions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="briefing" className="gap-2">
            <FileText className="w-4 h-4" />
            Briefing
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Briefing Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Latest Briefing
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : briefing ? (
                  <div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{briefing.summary}</p>
                    <Button variant="link" size="sm" className="p-0 h-auto mt-2" onClick={() => setActiveTab("briefing")}>
                      Read full briefing <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Generate your first briefing to get started.</p>
                )}
              </CardContent>
            </Card>

            {/* Active Agents */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Active Agents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : agents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No agents configured yet.</p>
                ) : (
                  <div className="space-y-3">
                    {agents.map((agent) => (
                      <div key={agent.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{agent.name}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            agent.isActive
                              ? "bg-green-500/10 text-green-500 border-green-500/20"
                              : "bg-muted text-muted-foreground border-border",
                          )}
                        >
                          {agent.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Module Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Module Intelligence Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {["compliance", "resources", "crm", "operations"].map((module) => {
                  const moduleFindings = findings.filter((f) => f.sourceModule === module)
                  const totalRisk = moduleFindings.reduce((s, f) => s + (f.monetaryRisk || 0), 0)
                  const colors = moduleColors[module] || "text-muted-foreground"
                  return (
                    <Card key={module} className={cn("border-l-4", colors.split(" ")[2])}>
                      <CardContent className="p-4">
                        <p className="font-medium capitalize">{module}</p>
                        <p className="text-2xl font-bold mt-1">{moduleFindings.length}</p>
                        <p className="text-xs text-muted-foreground">
                          {totalRisk > 0 ? `$${totalRisk.toLocaleString()} at risk` : "No issues"}
                        </p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={runMonitors} disabled={isRunningMonitors}>
              <RefreshCw className={cn("w-4 h-4 mr-2", isRunningMonitors && "animate-spin")} />
              Scan All Modules
            </Button>
            <Button variant="secondary" size="sm" onClick={autoAssign}>
              <PlayCircle className="w-4 h-4 mr-2" />
              Assign All Findings
            </Button>
            <Button variant="secondary" size="sm" onClick={generateBriefing} disabled={isGeneratingBriefing}>
              <Sparkles className={cn("w-4 h-4 mr-2", isGeneratingBriefing && "animate-pulse")} />
              Generate Briefing
            </Button>
          </div>
        </TabsContent>

        {/* Findings Tab */}
        <TabsContent value="findings" className="space-y-4 mt-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))
          ) : findings.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium">All Clear</p>
                <p className="text-sm text-muted-foreground">No active findings. Run a scan to check for new issues.</p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence>
              {findings.map((finding, index) => (
                <motion.div
                  key={finding.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      expandedFinding === finding.id && "ring-1 ring-primary/30",
                    )}
                    onClick={() => setExpandedFinding(expandedFinding === finding.id ? null : finding.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={cn("text-xs", moduleColors[finding.sourceModule] || "")}>
                              {finding.sourceModule}
                            </Badge>
                            <Badge variant="outline" className={cn("text-xs", severityColor(finding.monetaryRisk))}>
                              ${finding.monetaryRisk?.toLocaleString() || "0"} risk
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                finding.confidence >= 0.8
                                  ? "text-green-500 border-green-500/20 bg-green-500/10"
                                  : "text-amber-500 border-amber-500/20 bg-amber-500/10",
                              )}
                            >
                              {Math.round(finding.confidence * 100)}% confidence
                            </Badge>
                            {finding.requiresApproval && (
                              <Badge variant="secondary" className="text-xs">
                                Needs approval
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-medium">{finding.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{finding.description}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {formatDistance(finding.detectedAt)}
                          </p>

                          {expandedFinding === finding.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="mt-3 space-y-3"
                            >
                              {finding.suggestedAction && (
                                <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                                  <p className="text-xs font-medium mb-1">Suggested Action:</p>
                                  <p className="text-sm text-muted-foreground">{finding.suggestedAction}</p>
                                </div>
                              )}

                              {/* Causal chain evidence */}
                              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                  <Network className="w-3 h-3 text-blue-500" />
                                  <p className="text-xs font-medium text-blue-500">Causal Chain</p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  This finding may impact connected entities across {finding.sourceModule} and other modules.
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 h-auto text-xs ml-1"
                                    onClick={(e) => { e.stopPropagation(); setActiveTab("briefing") }}
                                  >
                                    View full chain <ChevronRight className="w-3 h-3 inline" />
                                  </Button>
                                </p>
                              </div>

                              {/* One-tap resolution */}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  disabled={resolvingFinding === finding.id}
                                  onClick={(e) => { e.stopPropagation(); resolveFinding(finding.id) }}
                                >
                                  {resolvingFinding === finding.id ? (
                                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                  )}
                                  {resolvingFinding === finding.id ? "Resolving..." : "Resolve Now"}
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </div>

                        <div className="flex flex-col items-center gap-1 min-w-[48px]">
                          <div className="relative w-12 h-12">
                            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                              <circle cx="18" cy="18" r="16" fill="none" className="stroke-secondary" strokeWidth="3" />
                              <circle
                                cx="18"
                                cy="18"
                                r="16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeDasharray={`${finding.confidence * 100} ${(1 - finding.confidence) * 100}`}
                                className={finding.confidence >= 0.8 ? "text-green-500" : finding.confidence >= 0.5 ? "text-amber-500" : "text-red-500"}
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                              {Math.round(finding.impactScore)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-4 mt-4">
          {pendingActions.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium">No Pending Actions</p>
                <p className="text-sm text-muted-foreground">All findings have been processed or assigned.</p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence>
              {pendingActions.map((action, index) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card>
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Zap className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {action.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {action.targetModule}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{action.type.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">Agent: {action.agentId}</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => approveAction(action.id)}>
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </TabsContent>

        {/* Briefing Tab */}
        <TabsContent value="briefing" className="space-y-4 mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ) : briefing ? (
            <>
              {/* Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(briefing.metrics || []).map((metric) => (
                  <Card key={metric.label}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">{metric.label}</p>
                      <p className="text-xl font-bold mt-1">
                        {typeof metric.value === "number" && metric.value > 1000
                          ? `$${(metric.value / 1000).toFixed(1)}k`
                          : metric.value.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        {metric.trend === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
                        {metric.trend === "down" && <TrendingDown className="w-3 h-3 text-red-500" />}
                        <span
                          className={cn(
                            "text-xs",
                            metric.trend === "up" ? "text-green-500" : metric.trend === "down" ? "text-red-500" : "text-muted-foreground",
                          )}
                        >
                          {metric.change > 0 ? "+" : ""}
                          {metric.change}% vs last period
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Briefing Content */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Executive Briefing — {briefing.date}
                    <Button variant="ghost" size="sm" onClick={generateBriefing} disabled={isGeneratingBriefing} className="ml-auto">
                      <RefreshCw className={cn("w-4 h-4 mr-1", isGeneratingBriefing && "animate-spin")} />
                      Regenerate
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{briefing.summary}</p>

                  {(briefing.actionItems || []).length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium mb-3">Action Items</h4>
                      <div className="space-y-2">
                        {(briefing.actionItems || []).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50"
                          >
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full mt-1.5 shrink-0",
                                item.priority === "high"
                                  ? "bg-red-500"
                                  : item.priority === "medium"
                                    ? "bg-amber-500"
                                    : "bg-green-500",
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{item.title}</p>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                              <Badge variant="outline" className="text-xs mt-1">
                                {item.module}
                              </Badge>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs capitalize",
                                item.priority === "high"
                                  ? "text-red-500 border-red-500/20 bg-red-500/10"
                                  : item.priority === "medium"
                                    ? "text-amber-500 border-amber-500/20 bg-amber-500/10"
                                    : "text-green-500 border-green-500/20 bg-green-500/10",
                              )}
                            >
                              {item.priority}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No Briefing Yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate your first executive briefing to get a summary of findings, metrics, and action items.
                </p>
                <Button onClick={generateBriefing} disabled={isGeneratingBriefing}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Briefing
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function formatDistance(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
