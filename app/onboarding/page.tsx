"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { 
  Brain, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Check,
  Building2,
  Target,
  Wrench,
  Loader2,
  Heart,
  ShoppingCart,
  Factory,
  Cpu,
  Wheat,
  Pill,
  Truck,
  Zap,
  GraduationCap,
  Building,
  Film,
  Plane,
  MoreHorizontal,
  MessageSquare
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  QUESTIONNAIRE_STEPS,
  INDUSTRIES,
  COMPANY_SIZES,
  EMPLOYEE_RANGES,
  REVENUE_RANGES,
  BUSINESS_STAGES,
  PRIMARY_GOALS,
  CHALLENGES,
  TECHNICAL_MATURITY,
  EXISTING_TOOLS,
  BUDGET_RANGES,
  TIMELINE_URGENCY,
  GEOGRAPHIC_SCOPE,
  COMPLIANCE_REQUIREMENTS,
  WARMUP_QUESTIONS,
  DEFAULT_QUESTIONNAIRE_DATA,
  type QuestionnaireData
} from "@/lib/questionnaire-data"
import { analyzeBusinessProfile, type AIAnalysisResult } from "@/lib/ai-business-analyzer"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Heart,
  Building2,
  ShoppingCart,
  Factory,
  Cpu,
  Wheat,
  Pill,
  Truck,
  Zap,
  GraduationCap,
  Building,
  Film,
  Plane,
  MoreHorizontal
}

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<QuestionnaireData>(DEFAULT_QUESTIONNAIRE_DATA)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [warmupQuestion] = useState(() => 
    WARMUP_QUESTIONS[Math.floor(Math.random() * WARMUP_QUESTIONS.length)]
  )

  const updateData = useCallback(<K extends keyof QuestionnaireData>(
    key: K, 
    value: QuestionnaireData[K]
  ) => {
    setData(prev => ({ ...prev, [key]: value }))
  }, [])

  const toggleArrayValue = useCallback((key: keyof QuestionnaireData, value: string) => {
    setData(prev => {
      const current = prev[key] as string[]
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...prev, [key]: updated }
    })
  }, [])

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 1:
        return true
      case 2:
        return data.industry && data.companySize && data.businessStage
      case 3:
        return data.primaryGoals.length > 0 && data.currentChallenges.length > 0
      case 4:
        return data.technicalMaturity && data.budgetRange && data.timelineUrgency
      case 5:
        return analysisResult !== null
      default:
        return false
    }
  }, [currentStep, data, analysisResult])

  const runAIAnalysis = useCallback(async () => {
    setIsAnalyzing(true)
    setAnalysisProgress(0)

    // Simulate progress
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => Math.min(prev + Math.random() * 15, 90))
    }, 500)

    try {
      const result = await analyzeBusinessProfile({
        industry: data.industry,
        subIndustry: data.subIndustry,
        companySize: data.companySize,
        employeeCountRange: data.employeeCountRange,
        annualRevenueRange: data.annualRevenueRange,
        businessStage: data.businessStage,
        primaryGoals: data.primaryGoals,
        currentChallenges: data.currentChallenges,
        existingTools: data.existingTools,
        technicalMaturity: data.technicalMaturity,
        budgetRange: data.budgetRange,
        timelineUrgency: data.timelineUrgency,
        geographicScope: data.geographicScope,
        complianceRequirements: data.complianceRequirements
      })

      clearInterval(progressInterval)
      setAnalysisProgress(100)
      setAnalysisResult(result)
    } catch (error) {
      console.error("[v0] Analysis error:", error)
    } finally {
      clearInterval(progressInterval)
      setIsAnalyzing(false)
    }
  }, [data])

  useEffect(() => {
    if (currentStep === 5 && !analysisResult && !isAnalyzing) {
      Promise.resolve().then(() => setIsAnalyzing(true))
      fetch("/api/v1/ai/analyze-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then((res) => res.ok ? res.json() : Promise.reject())
        .then((result) => setAnalysisResult(result))
        .catch(() => {})
        .finally(() => setIsAnalyzing(false))
    }
  }, [currentStep, analysisResult, isAnalyzing, data])

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1)
    } else if (analysisResult) {
      // Save to localStorage for recommendations page
      localStorage.setItem("digit_questionnaire", JSON.stringify(data))
      localStorage.setItem("digit_analysis", JSON.stringify(analysisResult))
      router.push("/onboarding/recommendations")
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const step = QUESTIONNAIRE_STEPS[currentStep - 1]

  return (
    <div className="min-h-screen bg-background">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 container max-w-4xl mx-auto px-4 py-8">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Step {currentStep} of 5</span>
            <span className="text-sm text-muted-foreground">{Math.round((currentStep / 5) * 100)}% complete</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-cyan-500"
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / 5) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {QUESTIONNAIRE_STEPS.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-1 text-xs",
                  i + 1 <= currentStep ? "text-primary" : "text-muted-foreground"
                )}
              >
                {i + 1 < currentStep ? (
                  <Check className="w-3 h-3" />
                ) : i + 1 === currentStep ? (
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-muted" />
                )}
                <span className="hidden sm:inline">{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-8">
                {/* Step header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                    {currentStep === 1 && <Brain className="w-8 h-8 text-primary" />}
                    {currentStep === 2 && <Building2 className="w-8 h-8 text-primary" />}
                    {currentStep === 3 && <Target className="w-8 h-8 text-primary" />}
                    {currentStep === 4 && <Wrench className="w-8 h-8 text-primary" />}
                    {currentStep === 5 && <Sparkles className="w-8 h-8 text-primary" />}
                  </div>
                  <h1 className="text-2xl font-bold mb-2">{step.title}</h1>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>

                {/* Step 1: Welcome */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="text-center space-y-4">
                      <p className="text-lg">
                        Welcome to <span className="text-primary font-semibold">DigiT Enterprise Intelligence</span>
                      </p>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Our AI will analyze your business needs and recommend the perfect software solutions tailored specifically for you.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
                      {[
                        { icon: MessageSquare, title: "Quick Questions", desc: "Just 3 minutes" },
                        { icon: Brain, title: "AI Analysis", desc: "Smart recommendations" },
                        { icon: Sparkles, title: "Custom Solutions", desc: "Tailored for you" }
                      ].map((item, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="text-center p-4 rounded-xl bg-secondary/50"
                        >
                          <item.icon className="w-8 h-8 text-primary mx-auto mb-2" />
                          <h3 className="font-medium">{item.title}</h3>
                          <p className="text-sm text-muted-foreground">{item.desc}</p>
                        </motion.div>
                      ))}
                    </div>

                    {/* Warm-up question */}
                    <div className="bg-primary/5 rounded-xl p-6 border border-primary/20">
                      <Label className="text-sm text-primary mb-2 block">
                        Before we start, a quick warm-up:
                      </Label>
                      <p className="text-lg font-medium mb-4">{warmupQuestion}</p>
                      <Textarea
                        placeholder="Share your thoughts... (optional)"
                        value={data.warmupResponse || ""}
                        onChange={(e) => updateData("warmupResponse", e.target.value)}
                        className="bg-background/50"
                        rows={3}
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Industry & Size */}
                {currentStep === 2 && (
                  <div className="space-y-8">
                    {/* Industry selection */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">What industry are you in?</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {INDUSTRIES.map((industry) => {
                          const Icon = iconMap[industry.icon] || Building2
                          return (
                            <button
                              key={industry.value}
                              onClick={() => updateData("industry", industry.value)}
                              className={cn(
                                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                                data.industry === industry.value
                                  ? "border-primary bg-primary/10"
                                  : "border-border/50 hover:border-primary/50 hover:bg-secondary/50"
                              )}
                            >
                              <Icon className={cn(
                                "w-6 h-6",
                                data.industry === industry.value ? "text-primary" : "text-muted-foreground"
                              )} />
                              <span className="text-xs text-center font-medium">{industry.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Sub-industry */}
                    {data.industry && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                      >
                        <Label className="text-sm font-medium mb-2 block">Specific focus area (optional)</Label>
                        <Input
                          placeholder="e.g., B2B SaaS, Organic Farming, Investment Banking..."
                          value={data.subIndustry || ""}
                          onChange={(e) => updateData("subIndustry", e.target.value)}
                          className="bg-background/50"
                        />
                      </motion.div>
                    )}

                    {/* Company size */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Company size</Label>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {COMPANY_SIZES.map((size) => (
                          <button
                            key={size.value}
                            onClick={() => updateData("companySize", size.value)}
                            className={cn(
                              "flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all",
                              data.companySize === size.value
                                ? "border-primary bg-primary/10"
                                : "border-border/50 hover:border-primary/50 hover:bg-secondary/50"
                            )}
                          >
                            <span className="font-medium">{size.label}</span>
                            <span className="text-xs text-muted-foreground">{size.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Employee count & Revenue */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Employee count</Label>
                        <div className="flex flex-wrap gap-2">
                          {EMPLOYEE_RANGES.map((range) => (
                            <button
                              key={range.value}
                              onClick={() => updateData("employeeCountRange", range.value)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-sm border transition-all",
                                data.employeeCountRange === range.value
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border/50 hover:border-primary/50"
                              )}
                            >
                              {range.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Annual revenue</Label>
                        <div className="flex flex-wrap gap-2">
                          {REVENUE_RANGES.map((range) => (
                            <button
                              key={range.value}
                              onClick={() => updateData("annualRevenueRange", range.value)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-sm border transition-all",
                                data.annualRevenueRange === range.value
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border/50 hover:border-primary/50"
                              )}
                            >
                              {range.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Business stage & Geographic scope */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label className="text-sm font-medium mb-3 block">Business stage</Label>
                        <div className="space-y-2">
                          {BUSINESS_STAGES.map((stage) => (
                            <button
                              key={stage.value}
                              onClick={() => updateData("businessStage", stage.value)}
                              className={cn(
                                "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                                data.businessStage === stage.value
                                  ? "border-primary bg-primary/10"
                                  : "border-border/50 hover:border-primary/50"
                              )}
                            >
                              <span className="font-medium">{stage.label}</span>
                              <span className="text-xs text-muted-foreground">{stage.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-3 block">Geographic scope</Label>
                        <div className="space-y-2">
                          {GEOGRAPHIC_SCOPE.map((scope) => (
                            <button
                              key={scope.value}
                              onClick={() => updateData("geographicScope", scope.value)}
                              className={cn(
                                "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                                data.geographicScope === scope.value
                                  ? "border-primary bg-primary/10"
                                  : "border-border/50 hover:border-primary/50"
                              )}
                            >
                              <span className="font-medium">{scope.label}</span>
                              <span className="text-xs text-muted-foreground">{scope.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Goals & Challenges */}
                {currentStep === 3 && (
                  <div className="space-y-8">
                    {/* Primary goals */}
                    <div>
                      <Label className="text-sm font-medium mb-1 block">What are your primary goals?</Label>
                      <p className="text-xs text-muted-foreground mb-3">Select all that apply</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {PRIMARY_GOALS.map((goal) => (
                          <button
                            key={goal.value}
                            onClick={() => toggleArrayValue("primaryGoals", goal.value)}
                            className={cn(
                              "flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left",
                              data.primaryGoals.includes(goal.value)
                                ? "border-primary bg-primary/10"
                                : "border-border/50 hover:border-primary/50"
                            )}
                          >
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                              data.primaryGoals.includes(goal.value)
                                ? "border-primary bg-primary"
                                : "border-muted-foreground"
                            )}>
                              {data.primaryGoals.includes(goal.value) && (
                                <Check className="w-3 h-3 text-primary-foreground" />
                              )}
                            </div>
                            <div>
                              <span className="font-medium block">{goal.label}</span>
                              <span className="text-xs text-muted-foreground">{goal.description}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Current challenges */}
                    <div>
                      <Label className="text-sm font-medium mb-1 block">What challenges are you facing?</Label>
                      <p className="text-xs text-muted-foreground mb-3">Select all that apply</p>
                      <div className="flex flex-wrap gap-2">
                        {CHALLENGES.map((challenge) => (
                          <button
                            key={challenge.value}
                            onClick={() => toggleArrayValue("currentChallenges", challenge.value)}
                            className={cn(
                              "px-4 py-2 rounded-full border-2 transition-all",
                              data.currentChallenges.includes(challenge.value)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/50 hover:border-primary/50"
                            )}
                          >
                            {challenge.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Selected summary */}
                    {(data.primaryGoals.length > 0 || data.currentChallenges.length > 0) && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-secondary/50 rounded-xl p-4"
                      >
                        <p className="text-sm text-muted-foreground">
                          You&apos;ve selected <span className="text-primary font-medium">{data.primaryGoals.length} goals</span> and{" "}
                          <span className="text-primary font-medium">{data.currentChallenges.length} challenges</span>.
                          Our AI will use this to find the best solutions for you.
                        </p>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Step 4: Technical Readiness */}
                {currentStep === 4 && (
                  <div className="space-y-8">
                    {/* Technical maturity */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Technical maturity level</Label>
                      <div className="space-y-2">
                        {TECHNICAL_MATURITY.map((level) => (
                          <button
                            key={level.value}
                            onClick={() => updateData("technicalMaturity", level.value)}
                            className={cn(
                              "w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                              data.technicalMaturity === level.value
                                ? "border-primary bg-primary/10"
                                : "border-border/50 hover:border-primary/50"
                            )}
                          >
                            <span className="font-medium">{level.label}</span>
                            <span className="text-sm text-muted-foreground">{level.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Existing tools */}
                    <div>
                      <Label className="text-sm font-medium mb-1 block">What tools are you currently using?</Label>
                      <p className="text-xs text-muted-foreground mb-3">Select all that apply</p>
                      <div className="flex flex-wrap gap-2">
                        {EXISTING_TOOLS.map((tool) => (
                          <button
                            key={tool.value}
                            onClick={() => toggleArrayValue("existingTools", tool.value)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-sm border-2 transition-all",
                              data.existingTools.includes(tool.value)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/50 hover:border-primary/50"
                            )}
                          >
                            {tool.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Budget & Timeline */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label className="text-sm font-medium mb-3 block">Budget range</Label>
                        <div className="space-y-2">
                          {BUDGET_RANGES.map((range) => (
                            <button
                              key={range.value}
                              onClick={() => updateData("budgetRange", range.value)}
                              className={cn(
                                "w-full p-3 rounded-lg border text-left transition-all",
                                data.budgetRange === range.value
                                  ? "border-primary bg-primary/10"
                                  : "border-border/50 hover:border-primary/50"
                              )}
                            >
                              {range.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-3 block">Implementation timeline</Label>
                        <div className="space-y-2">
                          {TIMELINE_URGENCY.map((timeline) => (
                            <button
                              key={timeline.value}
                              onClick={() => updateData("timelineUrgency", timeline.value)}
                              className={cn(
                                "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                                data.timelineUrgency === timeline.value
                                  ? "border-primary bg-primary/10"
                                  : "border-border/50 hover:border-primary/50"
                              )}
                            >
                              <span className="font-medium">{timeline.label}</span>
                              <span className="text-xs text-muted-foreground">{timeline.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Compliance requirements */}
                    <div>
                      <Label className="text-sm font-medium mb-1 block">Compliance requirements</Label>
                      <p className="text-xs text-muted-foreground mb-3">Select any that apply to your business</p>
                      <div className="flex flex-wrap gap-2">
                        {COMPLIANCE_REQUIREMENTS.map((req) => (
                          <button
                            key={req.value}
                            onClick={() => toggleArrayValue("complianceRequirements", req.value)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-sm border-2 transition-all",
                              data.complianceRequirements.includes(req.value)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/50 hover:border-primary/50"
                            )}
                            title={req.description}
                          >
                            {req.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: AI Analysis */}
                {currentStep === 5 && (
                  <div className="space-y-8">
                    {isAnalyzing ? (
                      <div className="text-center py-12">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="w-20 h-20 mx-auto mb-6"
                        >
                          <Brain className="w-full h-full text-primary" />
                        </motion.div>
                        <h3 className="text-xl font-semibold mb-2">Analyzing your business...</h3>
                        <p className="text-muted-foreground mb-6">
                          Our AI is finding the perfect solutions for you
                        </p>
                        <div className="max-w-md mx-auto">
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-primary to-cyan-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${analysisProgress}%` }}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            {analysisProgress < 30 && "Analyzing industry data..."}
                            {analysisProgress >= 30 && analysisProgress < 60 && "Matching solutions to your needs..."}
                            {analysisProgress >= 60 && analysisProgress < 90 && "Generating recommendations..."}
                            {analysisProgress >= 90 && "Almost done..."}
                          </p>
                        </div>
                      </div>
                    ) : analysisResult ? (
                      <div className="space-y-6">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                            <Check className="w-8 h-8 text-green-500" />
                          </div>
                          <h3 className="text-xl font-semibold mb-2">Analysis Complete!</h3>
                          <p className="text-muted-foreground">
                            We found {analysisResult.recommendations.length} solutions tailored for your business
                          </p>
                        </div>

                        {/* Confidence score */}
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-sm text-muted-foreground">AI Confidence:</span>
                          <Badge variant={analysisResult.confidenceScore > 0.8 ? "default" : "secondary"}>
                            {Math.round(analysisResult.confidenceScore * 100)}%
                          </Badge>
                        </div>

                        {/* Quick preview */}
                        <div className="bg-secondary/50 rounded-xl p-6">
                          <h4 className="font-medium mb-3">Quick Preview</h4>
                          <p className="text-sm text-muted-foreground mb-4">
                            {analysisResult.overallAnalysis.slice(0, 200)}...
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {analysisResult.recommendations.slice(0, 3).map((rec) => (
                              <Badge key={rec.moduleId} variant="outline" className="text-primary border-primary">
                                {rec.moduleName} ({rec.score}%)
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Next steps preview */}
                        <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                          <h4 className="font-medium mb-2 text-primary">What&apos;s next?</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {analysisResult.suggestedNextSteps.slice(0, 3).map((step, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <ArrowRight className="w-3 h-3 text-primary" />
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                        <p className="text-muted-foreground">Preparing analysis...</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    disabled={currentStep === 1}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="gap-2 bg-gradient-to-r from-primary to-cyan-600 hover:from-primary/90 hover:to-cyan-600/90"
                  >
                    {currentStep === 5 ? "View Recommendations" : "Continue"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
