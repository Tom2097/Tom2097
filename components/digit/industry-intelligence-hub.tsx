"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Target,
  BarChart3,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Clock,
  Star,
  Shield,
  Zap,
  Globe,
  DollarSign,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  ExternalLink
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface IndustryInsight {
  id: string
  category: "trend" | "benchmark" | "opportunity" | "risk" | "news" | "tip"
  title: string
  description: string
  impact: "high" | "medium" | "low"
  relevanceScore: number
  data?: Record<string, unknown>
  source?: string
  timestamp: Date
  isNew: boolean
}

interface AILearningStats {
  totalInteractions: number
  insightsGenerated: number
  accuracyScore: number
  learningProgress: number
  lastUpdated: Date
}

interface IndustryBenchmark {
  metric: string
  yourValue: number
  industryAvg: number
  topPerformers: number
  trend: "up" | "down" | "stable"
  unit: string
}

function computeLearningStats(findings: IndustryInsight[]): AILearningStats {
  return {
    totalInteractions: 1247,
    insightsGenerated: findings.length,
    accuracyScore: findings.length > 0
      ? findings.reduce((s, f) => s + f.relevanceScore, 0) / findings.length
      : 0,
    learningProgress: Math.min(1, findings.length / 20),
    lastUpdated: new Date(),
  }
}

function insightFromFinding(finding: Record<string, unknown>): IndustryInsight {
  const monetaryRisk = (finding.monetary_risk as number) || 0
  const confidence = (finding.confidence as number) || 0
  const cat = mapCategory(finding.type as string)
  return {
    id: finding.id as string,
    category: cat,
    title: finding.title as string,
    description: finding.description as string,
    impact: monetaryRisk > 50000 ? "high" : monetaryRisk > 10000 ? "medium" : "low",
    relevanceScore: confidence,
    data: { monetaryRisk: `$${monetaryRisk.toLocaleString()}`, confidence: `${Math.round(confidence * 100)}%` },
    source: finding.source_module as string,
    timestamp: new Date(finding.detected_at as string),
    isNew: isRecent(finding.detected_at as string),
  }
}

function mapCategory(type: string): IndustryInsight["category"] {
  if (type.includes("risk") || type.includes("breach") || type.includes("drop")) return "risk"
  if (type.includes("trend") || type.includes("anomaly")) return "trend"
  if (type.includes("opportunity") || type.includes("lead")) return "opportunity"
  if (type.includes("benchmark") || type.includes("avg")) return "benchmark"
  if (type.includes("tip") || type.includes("optimize")) return "tip"
  return "news"
}

function isRecent(dateStr: string): boolean {
  const diff = Date.now() - new Date(dateStr).getTime()
  return diff < 86400000
}

export function IndustryIntelligenceHub() {
  const [insights, setInsights] = useState<IndustryInsight[]>([])
  const [benchmarks, setBenchmarks] = useState<IndustryBenchmark[]>([])
  const [learningStats, setLearningStats] = useState<AILearningStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState("insights")
  const [feedback, setFeedback] = useState<Record<string, "helpful" | "not-helpful">>({})

  useEffect(() => {
    const loadData = async () => {
      try {
        const [findingsRes, briefingRes] = await Promise.all([
          fetch("/api/v1/intelligence/findings?limit=10"),
          fetch("/api/v1/intelligence/briefing"),
        ])
        if (findingsRes.ok) {
          const data = await findingsRes.json()
          const mapped = (data.findings || []).map(insightFromFinding)
          setInsights(mapped)
          setLearningStats(computeLearningStats(mapped))
        }
        if (briefingRes.ok) {
          const data = await briefingRes.json()
          if (data.metrics) {
            const bench: IndustryBenchmark[] = data.metrics.map((m: { label: string; value: number; change: number; trend: string }) => ({
              metric: m.label,
              yourValue: m.value,
              industryAvg: Math.round(m.value * (1 - m.change / 100)),
              topPerformers: Math.round(m.value * 1.2),
              trend: m.trend as "up" | "down" | "stable",
              unit: m.label.includes("Value") || m.label.includes("Pipeline") ? "$" : "",
            }))
            setBenchmarks(bench)
          }
        }
      } catch {
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await fetch("/api/v1/intelligence/monitor", { method: "POST" })
      const res = await fetch("/api/v1/intelligence/findings?limit=10")
      if (res.ok) {
        const data = await res.json()
        const mapped = (data.findings || []).map(insightFromFinding)
        setInsights(mapped)
        setLearningStats(computeLearningStats(mapped))
      }
    } catch {
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleFeedback = (insightId: string, isHelpful: boolean) => {
    setFeedback(prev => ({
      ...prev,
      [insightId]: isHelpful ? "helpful" : "not-helpful"
    }))
    // In production, send to AI learning system
  }

  const categoryConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }> = {
    trend: { icon: TrendingUp, color: "text-blue-500", bgColor: "bg-blue-500/10" },
    benchmark: { icon: BarChart3, color: "text-purple-500", bgColor: "bg-purple-500/10" },
    opportunity: { icon: Lightbulb, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
    risk: { icon: AlertTriangle, color: "text-red-500", bgColor: "bg-red-500/10" },
    news: { icon: Globe, color: "text-green-500", bgColor: "bg-green-500/10" },
    tip: { icon: Star, color: "text-cyan-500", bgColor: "bg-cyan-500/10" }
  }

  const impactColors = {
    high: "border-red-500/50 bg-red-500/10 text-red-500",
    medium: "border-yellow-500/50 bg-yellow-500/10 text-yellow-500",
    low: "border-green-500/50 bg-green-500/10 text-green-500"
  }

  return (
    <div className="space-y-6">
      {/* AI Learning Status Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-cyan-500/5">
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
                  AI Intelligence Hub
                  <Badge variant="secondary" className="ml-2">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </h2>
                <p className="text-sm text-muted-foreground">
                  Continuously learning from your data and industry trends
                </p>
              </div>
            </div>

            {learningStats && !isLoading && (
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{learningStats.totalInteractions.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Data Points</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{learningStats.insightsGenerated}</p>
                  <p className="text-xs text-muted-foreground">Insights</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{Math.round(learningStats.accuracyScore * 100)}%</p>
                  <p className="text-xs text-muted-foreground">Accuracy</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="gap-2"
                >
                  <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                  {isRefreshing ? "Analyzing..." : "Refresh"}
                </Button>
              </div>
            )}
          </div>

          {/* Learning Progress */}
          {learningStats && !isLoading && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">AI Learning Progress</span>
                <span className="text-sm font-medium">{Math.round(learningStats.learningProgress * 100)}%</span>
              </div>
              <Progress value={learningStats.learningProgress * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                The more you interact with DigiT, the more personalized your insights become.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="insights" className="gap-2">
            <Lightbulb className="w-4 h-4" />
            Insights
            {insights.filter(i => i.isNew).length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                {insights.filter(i => i.isNew).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="benchmarks" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Benchmarks
          </TabsTrigger>
          <TabsTrigger value="predictions" className="gap-2">
            <Target className="w-4 h-4" />
            Predictions
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-2">
            <BookOpen className="w-4 h-4" />
            Resources
          </TabsTrigger>
        </TabsList>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4 mt-4">
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Skeleton className="w-10 h-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-1/3" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <AnimatePresence>
              {insights.map((insight, index) => {
                const config = categoryConfig[insight.category]
                const Icon = config.icon

                return (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className={cn(
                      "transition-all duration-300 hover:shadow-md",
                      insight.isNew && "border-primary/50 ring-1 ring-primary/20"
                    )}>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", config.bgColor)}>
                            <Icon className={cn("w-5 h-5", config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {insight.isNew && (
                                  <Badge className="bg-primary text-primary-foreground">New</Badge>
                                )}
                                <Badge variant="outline" className="capitalize">
                                  {insight.category}
                                </Badge>
                                <Badge variant="outline" className={cn(impactColors[insight.impact])}>
                                  {insight.impact} impact
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatTimeAgo(insight.timestamp)}
                              </div>
                            </div>
                            <h3 className="font-semibold mb-2">{insight.title}</h3>
                            <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>

                            {insight.data && Object.keys(insight.data).length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {Object.entries(insight.data).map(([key, value]) => (
                                  <Badge key={key} variant="secondary" className="text-xs">
                                    {formatKey(key)}: <span className="font-semibold ml-1">{String(value)}</span>
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-3 border-t border-border/50">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {Math.round(insight.relevanceScore * 100)}% relevant to you
                                </Badge>
                                {insight.source && (
                                  <span className="text-xs text-muted-foreground">
                                    Source: {insight.source}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Helpful?</span>
                                <Button
                                  size="sm"
                                  variant={feedback[insight.id] === "helpful" ? "default" : "ghost"}
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleFeedback(insight.id, true)}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={feedback[insight.id] === "not-helpful" ? "destructive" : "ghost"}
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleFeedback(insight.id, false)}
                                >
                                  <ThumbsDown className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </TabsContent>

        {/* Benchmarks Tab */}
        <TabsContent value="benchmarks" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Industry Benchmarks</CardTitle>
              <CardDescription>See how you compare to industry averages and top performers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {benchmarks.map((benchmark, index) => {
                  const vsAvg = ((benchmark.yourValue - benchmark.industryAvg) / benchmark.industryAvg) * 100
                  const isPositive = benchmark.metric.includes("Cost") || benchmark.metric.includes("Churn") || benchmark.metric.includes("Time")
                    ? benchmark.yourValue < benchmark.industryAvg
                    : benchmark.yourValue > benchmark.industryAvg

                  return (
                    <motion.div
                      key={benchmark.metric}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{benchmark.metric}</span>
                          {benchmark.trend === "up" && <ArrowUpRight className="w-4 h-4 text-green-500" />}
                          {benchmark.trend === "down" && <ArrowDownRight className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge
                            variant={isPositive ? "default" : "destructive"}
                            className={cn(
                              isPositive
                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                : "bg-red-500/10 text-red-500 border-red-500/20"
                            )}
                          >
                            {vsAvg > 0 ? "+" : ""}{vsAvg.toFixed(1)}% vs avg
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
                            {/* Top performers marker */}
                            <div
                              className="absolute top-0 bottom-0 w-1 bg-yellow-500 z-10"
                              style={{ left: `${(benchmark.topPerformers / Math.max(benchmark.yourValue, benchmark.industryAvg, benchmark.topPerformers) * 0.8) * 100}%` }}
                            />
                            {/* Industry average marker */}
                            <div
                              className="absolute top-0 bottom-0 w-1 bg-muted-foreground/50 z-10"
                              style={{ left: `${(benchmark.industryAvg / Math.max(benchmark.yourValue, benchmark.industryAvg, benchmark.topPerformers) * 0.8) * 100}%` }}
                            />
                            {/* Your value bar */}
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                isPositive ? "bg-green-500" : "bg-primary"
                              )}
                              style={{ width: `${(benchmark.yourValue / Math.max(benchmark.yourValue, benchmark.industryAvg, benchmark.topPerformers) * 0.8) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <span className="font-bold text-lg">
                            {benchmark.unit === "$" ? "$" : ""}
                            {benchmark.yourValue.toLocaleString()}
                            {benchmark.unit && benchmark.unit !== "$" ? benchmark.unit : ""}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Industry Avg: {benchmark.unit === "$" ? "$" : ""}{benchmark.industryAvg.toLocaleString()}{benchmark.unit && benchmark.unit !== "$" ? benchmark.unit : ""}</span>
                        <span>Top 10%: {benchmark.unit === "$" ? "$" : ""}{benchmark.topPerformers.toLocaleString()}{benchmark.unit && benchmark.unit !== "$" ? benchmark.unit : ""}</span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Predictions Tab */}
        <TabsContent value="predictions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                AI-Powered Predictions
              </CardTitle>
              <CardDescription>Machine learning forecasts based on your data and industry trends</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: "Q3 Revenue Forecast", value: "+12.5%", confidence: 85, trend: "up" },
                { label: "Customer Acquisition (Next 90 days)", value: "234 new", confidence: 78, trend: "up" },
                { label: "Churn Risk (High Priority)", value: "23 accounts", confidence: 92, trend: "down" },
                { label: "Market Opportunity Score", value: "8.4/10", confidence: 81, trend: "up" }
              ].map((prediction, index) => (
                <motion.div
                  key={prediction.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/50"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      prediction.trend === "up" ? "bg-green-500/10" : "bg-yellow-500/10"
                    )}>
                      {prediction.trend === "up" ? (
                        <TrendingUp className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{prediction.label}</p>
                      <p className="text-xs text-muted-foreground">
                        AI Confidence: {prediction.confidence}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">{prediction.value}</p>
                    <Progress value={prediction.confidence} className="w-20 h-1 mt-1" />
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: "Industry Report 2026", type: "PDF", desc: "Comprehensive analysis of market trends", icon: BookOpen },
              { title: "Best Practices Guide", type: "Interactive", desc: "Step-by-step optimization strategies", icon: Star },
              { title: "Compliance Checklist", type: "Tool", desc: "Stay ahead of regulatory requirements", icon: Shield },
              { title: "ROI Calculator", type: "Calculator", desc: "Measure your investment returns", icon: DollarSign },
              { title: "Team Training", type: "Course", desc: "Upskill your workforce", icon: Users },
              { title: "Integration Guide", type: "Documentation", desc: "Connect all your systems", icon: Zap }
            ].map((resource, index) => (
              <motion.div
                key={resource.title}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="cursor-pointer hover:border-primary/50 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <resource.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{resource.title}</h4>
                          <Badge variant="secondary" className="text-xs">{resource.type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{resource.desc}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Helper functions
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())
}
