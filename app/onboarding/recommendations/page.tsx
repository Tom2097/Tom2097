"use client"
import { useI18n } from "@/components/providers/i18n-provider"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import {
  Brain,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Clock,
  DollarSign,
  BarChart3,
  Users,
  Heart,
  Building2,
  Wheat,
  Pill,
  Star,
  ThumbsUp,
  ThumbsDown,
  Info,
  Zap,
  Shield,
  Target
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { AnimatedGroup } from "@/components/motion-primitives/animated-group"
import { InView } from "@/components/motion-primitives/in-view"
import type { AIAnalysisResult, ModuleRecommendation, IndustryInsight } from "@/lib/ai-business-analyzer"
import type { QuestionnaireData } from "@/lib/questionnaire-data"

const moduleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  analytics: BarChart3,
  crm: Users,
  healthcare: Heart,
  banking: Building2,
  agro: Wheat,
  pharma: Pill
}

const moduleColors: Record<string, string> = {
  analytics: "from-blue-500 to-cyan-500",
  crm: "from-purple-500 to-pink-500",
  healthcare: "from-red-500 to-rose-500",
  banking: "from-green-500 to-emerald-500",
  agro: "from-yellow-500 to-amber-500",
  pharma: "from-indigo-500 to-violet-500"
}

function loadFromStorage(key: string) {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    return null
  }
}

export default function RecommendationsPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(loadFromStorage("digit_analysis"))
  const [questionnaireData, setQuestionnaireData] = useState<QuestionnaireData | null>(loadFromStorage("digit_questionnaire"))
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [feedback, setFeedback] = useState<Record<string, "helpful" | "not-helpful" | null>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showIntelligence, setShowIntelligence] = useState(false)

  useEffect(() => {
    if (!analysisResult || !questionnaireData) {
      router.push("/onboarding")
    }
  }, [analysisResult, questionnaireData, router])

  const toggleModule = (moduleId: string) => {
    setSelectedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(m => m !== moduleId)
        : [...prev, moduleId]
    )
  }

  const handleFeedback = (moduleId: string, isHelpful: boolean) => {
    setFeedback(prev => ({
      ...prev,
      [moduleId]: isHelpful ? "helpful" : "not-helpful"
    }))
    fetch("/api/v1/onboarding/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "feedback", moduleId, helpful: isHelpful }),
    }).catch(() => {})
  }

  const handleContinue = () => {
    if (selectedModules.length > 0) {
      localStorage.setItem("digit_selected_modules", JSON.stringify(selectedModules))
      setShowIntelligence(true)
    }
  }

  const handleFinish = () => {
    localStorage.setItem("digit_onboarding_complete", "true")
    fetch("/api/v1/onboarding/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", selectedModules, questionnaire: questionnaireData }),
    }).catch(() => {}).finally(() => {
      router.push("/")
    })
  }

  if (isLoading || !analysisResult || !questionnaireData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading your recommendations...</p>
        </div>
      </div>
    )
  }

  if (showIntelligence) {
    return (
      <IndustryIntelligencePage
        analysisResult={analysisResult}
        questionnaireData={questionnaireData}
        selectedModules={selectedModules}
        onBack={() => setShowIntelligence(false)}
        onFinish={handleFinish}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      </div>

      <div className="relative z-10 container max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <AnimatedGroup className="text-center mb-8">
          <Badge className="mb-4" variant="secondary">
            <Sparkles className="w-3 h-3 mr-1" />
            {t("onboarding.recommendations.badge")}
          </Badge>
          <h1 className="text-3xl font-bold mb-2">{t("onboarding.recommendations.title")}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t("onboarding.recommendations.subtitle", { industry: questionnaireData.industry })}
          </p>
        </AnimatedGroup>

        {/* AI Confidence Banner */}
        <InView delay={0 * 0.08}>
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{t("onboarding.recommendations.confidenceTitle")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("onboarding.recommendations.confidenceDesc", { count: analysisResult.recommendations.length })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {Math.round(analysisResult.confidenceScore * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">{t("onboarding.recommendations.matchScore")}</p>
                  </div>
                  <Progress
                    value={analysisResult.confidenceScore * 100}
                    className="w-32 h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </InView>

        {/* Overall Analysis */}
        <InView delay={1 * 0.08}>
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shrink-0">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t("onboarding.recommendations.summaryTitle")}</h3>
                  <p className="text-muted-foreground">{analysisResult.overallAnalysis}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </InView>

        {/* Recommendations Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{t("onboarding.recommendations.recommendedSolutions")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("onboarding.recommendations.selectedOf", { selected: selectedModules.length, total: analysisResult.recommendations.length })}
            </p>
          </div>

          <div className="grid gap-4">
            {analysisResult.recommendations.map((rec, index) => {
              const Icon = moduleIcons[rec.moduleId] || BarChart3
              const gradient = moduleColors[rec.moduleId] || "from-primary to-cyan-500"
              const isSelected = selectedModules.includes(rec.moduleId)

              return (
                <motion.div
                  key={rec.moduleId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className={cn(
                      "cursor-pointer transition-all duration-300",
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border/50 hover:border-primary/50"
                    )}
                    onClick={() => toggleModule(rec.moduleId)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Module Icon & Score */}
                        <div className="relative">
                          <div className={cn(
                            "w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center",
                            gradient
                          )}>
                            <Icon className="w-8 h-8 text-white" />
                          </div>
                          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">#{rec.priorityRank}</span>
                          </div>
                        </div>

                        {/* Module Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div>
                              <h3 className="font-semibold text-lg">{rec.moduleName}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                  {t("onboarding.recommendations.matchPercent", { percent: rec.score })}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    rec.implementationComplexity === "low" && "border-green-500 text-green-500",
                                    rec.implementationComplexity === "medium" && "border-yellow-500 text-yellow-500",
                                    rec.implementationComplexity === "high" && "border-red-500 text-red-500"
                                  )}
                                >
                                  <Clock className="w-3 h-3 mr-1" />
                                  {t("onboarding.recommendations.complexity", { complexity: rec.implementationComplexity })}
                                </Badge>
                              </div>
                            </div>
                            <div className={cn(
                              "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all",
                              isSelected
                                ? "bg-primary border-primary"
                                : "border-muted-foreground"
                            )}>
                              {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground mb-3">{rec.reasoning}</p>

                          {/* Benefits */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {rec.keyBenefits.map((benefit, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                <Zap className="w-3 h-3 mr-1" />
                                {benefit}
                              </Badge>
                            ))}
                          </div>

                          {/* ROI & Feedback */}
                          <div className="flex items-center justify-between pt-3 border-t border-border/50">
                            <div className="flex items-center gap-2 text-sm">
                              <DollarSign className="w-4 h-4 text-green-500" />
                              <span className="text-muted-foreground">{t("onboarding.recommendations.estRoi")}</span>
                              <span className="font-medium text-green-500">{rec.estimatedROI}</span>
                            </div>

                            {/* Feedback buttons */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground mr-2">{t("onboarding.recommendations.helpfulQuestion")}</span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant={feedback[rec.moduleId] === "helpful" ? "default" : "ghost"}
                                      className="h-8 w-8 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleFeedback(rec.moduleId, true)
                                      }}
                                    >
                                      <ThumbsUp className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t("onboarding.recommendations.helpfulTooltip")}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant={feedback[rec.moduleId] === "not-helpful" ? "destructive" : "ghost"}
                                      className="h-8 w-8 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleFeedback(rec.moduleId, false)
                                      }}
                                    >
                                      <ThumbsDown className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{t("onboarding.recommendations.notRelevantTooltip")}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Selected Summary */}
        <AnimatePresence>
          {selectedModules.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4"
            >
              <div className="container max-w-6xl mx-auto flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {selectedModules.length === 1
                      ? t("onboarding.recommendations.moduleSelected_one", { count: selectedModules.length })
                      : t("onboarding.recommendations.moduleSelected_other", { count: selectedModules.length })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("onboarding.recommendations.continueHint")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" onClick={() => router.push("/onboarding")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t("onboarding.recommendations.backToOnboarding")}
                  </Button>
                  <Button
                    onClick={handleContinue}
                    className="bg-gradient-to-r from-primary to-cyan-600"
                  >
                    {t("onboarding.recommendations.continue")}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Spacer for fixed bottom bar */}
        {selectedModules.length > 0 && <div className="h-24" />}
      </div>
    </div>
  )
}

// Industry Intelligence Page Component
function IndustryIntelligencePage({
  analysisResult,
  questionnaireData,
  selectedModules,
  onBack,
  onFinish
}: {
  analysisResult: AIAnalysisResult
  questionnaireData: QuestionnaireData
  selectedModules: string[]
  onBack: () => void
  onFinish: () => void
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState("insights")
  const [isGenerating, setIsGenerating] = useState(true)

  useEffect(() => {
    // Simulate AI generating more intelligence
    const timer = setTimeout(() => setIsGenerating(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    trend: TrendingUp,
    benchmark: BarChart3,
    "best-practice": Star,
    opportunity: Zap,
    risk: Shield,
    regulation: Shield
  }

  const categoryColors: Record<string, string> = {
    trend: "text-blue-500 bg-blue-500/10",
    benchmark: "text-purple-500 bg-purple-500/10",
    "best-practice": "text-green-500 bg-green-500/10",
    opportunity: "text-yellow-500 bg-yellow-500/10",
    risk: "text-red-500 bg-red-500/10",
    regulation: "text-orange-500 bg-orange-500/10"
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      </div>

      <div className="relative z-10 container max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <AnimatedGroup className="text-center mb-8">
          <Badge className="mb-4" variant="secondary">
            <Brain className="w-3 h-3 mr-1" />
            {t("onboarding.recommendations.intelligenceBadge")}
          </Badge>
          <h1 className="text-3xl font-bold mb-2">{t("onboarding.recommendations.intelligenceTitle")}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t("onboarding.recommendations.intelligenceSubtitle", { industry: questionnaireData.industry })}
          </p>
        </AnimatedGroup>

        {/* Learning indicator */}
        <InView delay={0 * 0.08}>
          <Card className="mb-8 border-primary/20 bg-gradient-to-r from-primary/5 to-cyan-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-primary animate-pulse" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{t("onboarding.recommendations.learningTitle")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("onboarding.recommendations.learningDesc")}
                  </p>
                </div>
                {isGenerating && (
                  <Badge variant="secondary" className="animate-pulse">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {t("onboarding.recommendations.generating")}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </InView>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="insights">{t("onboarding.recommendations.insightsTab")}</TabsTrigger>
            <TabsTrigger value="resources">{t("onboarding.recommendations.resourcesTab")}</TabsTrigger>
            <TabsTrigger value="roadmap">{t("onboarding.recommendations.roadmapTab")}</TabsTrigger>
          </TabsList>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-4">
            {analysisResult.industryInsights.map((insight, index) => {
              const Icon = categoryIcons[insight.category] || Info
              const colorClass = categoryColors[insight.category] || "text-primary bg-primary/10"

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", colorClass)}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <Badge variant="outline" className="mb-2 capitalize">
                                {insight.category.replace("-", " ")}
                              </Badge>
                              <h3 className="font-semibold">{insight.title}</h3>
                            </div>
                            <Badge variant="secondary">
                              {t("onboarding.recommendations.relevantPercent", { percent: Math.round(insight.relevanceScore * 100) })}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-sm">{insight.description}</p>
                          {insight.data && Object.keys(insight.data).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {Object.entries(insight.data).map(([key, value]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key}: {String(value)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  {t("onboarding.recommendations.toolsTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedModules.map((moduleId) => {
                    const rec = analysisResult.recommendations.find(r => r.moduleId === moduleId)
                    const Icon = moduleIcons[moduleId] || BarChart3
                    const gradient = moduleColors[moduleId] || "from-primary to-cyan-500"

                    return (
                      <div
                        key={moduleId}
                        className="flex items-center gap-3 p-4 rounded-lg border border-border/50 bg-secondary/30"
                      >
                        <div className={cn("w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center", gradient)}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">{rec?.moduleName || moduleId}</p>
                          <p className="text-xs text-muted-foreground">{t("onboarding.recommendations.readyToConfigure")}</p>
                        </div>
                        <Badge variant="outline" className="ml-auto text-green-500 border-green-500">
                          <Check className="w-3 h-3 mr-1" />
                          {t("onboarding.recommendations.selected")}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  {t("onboarding.recommendations.complianceTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {questionnaireData.complianceRequirements.length > 0 ? (
                    questionnaireData.complianceRequirements.map((req) => (
                      <Badge key={req} variant="secondary" className="uppercase">
                        {req}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("onboarding.recommendations.noCompliance")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roadmap Tab */}
          <TabsContent value="roadmap" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  {t("onboarding.recommendations.roadmapTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysisResult.suggestedNextSteps.map((step, index) => (
                    <div key={index} className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">{index + 1}</span>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm">{step}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6 text-center">
                <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">{t("onboarding.recommendations.allSetTitle")}</h3>
                <p className="text-muted-foreground mb-4">
                  {t("onboarding.recommendations.allSetDesc")}
                </p>
                <Button
                  size="lg"
                  onClick={onFinish}
                  className="bg-gradient-to-r from-primary to-cyan-600"
                >
                  {t("onboarding.recommendations.launchDashboard")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("onboarding.recommendations.backToRecommendations")}
          </Button>
          <Button
            onClick={onFinish}
            className="bg-gradient-to-r from-primary to-cyan-600"
          >
            {t("onboarding.recommendations.completeSetup")}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
