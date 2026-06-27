"use server"

import { streamText, generateText } from "ai"
import { mistralModel } from "@/lib/ai/mistral"
import { z } from "zod"

// Types for the AI Business Analyzer
export interface BusinessProfile {
  industry: string
  subIndustry?: string
  companySize: string
  employeeCountRange: string
  annualRevenueRange: string
  businessStage: string
  primaryGoals: string[]
  currentChallenges: string[]
  existingTools: string[]
  technicalMaturity: string
  budgetRange: string
  timelineUrgency: string
  geographicScope: string
  complianceRequirements: string[]
}

export interface ModuleRecommendation {
  moduleId: string
  moduleName: string
  score: number
  reasoning: string
  keyBenefits: string[]
  estimatedROI: string
  implementationComplexity: "low" | "medium" | "high"
  priorityRank: number
}

export interface IndustryInsight {
  category: string
  title: string
  description: string
  data: Record<string, unknown>
  relevanceScore: number
}

export interface AIAnalysisResult {
  recommendations: ModuleRecommendation[]
  industryInsights: IndustryInsight[]
  overallAnalysis: string
  confidenceScore: number
  suggestedNextSteps: string[]
}

// Available modules for recommendation
const AVAILABLE_MODULES = [
  {
    id: "analytics",
    name: "AI Analytics",
    description: "Advanced business intelligence with predictive analytics, revenue forecasting, and operational insights",
    industries: ["all"],
    capabilities: ["forecasting", "reporting", "visualization", "predictive-analytics"]
  },
  {
    id: "crm",
    name: "CRM Intelligence",
    description: "AI-powered customer relationship management with lead scoring, churn prediction, and customer insights",
    industries: ["retail", "saas", "services", "finance"],
    capabilities: ["lead-management", "customer-insights", "sales-forecasting", "retention"]
  },
  {
    id: "healthcare",
    name: "Healthcare Analytics",
    description: "Patient management, clinical analytics, and healthcare compliance tools",
    industries: ["healthcare", "pharma", "biotech"],
    capabilities: ["patient-analytics", "clinical-insights", "compliance", "resource-optimization"]
  },
  {
    id: "banking",
    name: "Banking & Finance",
    description: "Risk assessment, fraud detection, portfolio management, and regulatory compliance",
    industries: ["finance", "banking", "insurance", "fintech"],
    capabilities: ["risk-analysis", "fraud-detection", "compliance", "portfolio-management"]
  },
  {
    id: "agro",
    name: "Agro-Tech Intelligence",
    description: "Crop analytics, supply chain optimization, weather integration, and yield prediction",
    industries: ["agriculture", "food", "commodities"],
    capabilities: ["crop-analytics", "supply-chain", "weather-analysis", "yield-prediction"]
  },
  {
    id: "pharma",
    name: "Pharma Analytics",
    description: "Drug development tracking, clinical trial analytics, regulatory compliance, and market analysis",
    industries: ["pharma", "biotech", "healthcare"],
    capabilities: ["drug-development", "clinical-trials", "regulatory", "market-analysis"]
  }
]

// System prompt for the AI analyzer
const SYSTEM_PROMPT = `You are DigiT's AI Business Analyst, an expert in enterprise software solutions and business intelligence. Your role is to analyze business requirements and recommend the most suitable software modules.

Available Modules:
${AVAILABLE_MODULES.map(m => `- ${m.name} (${m.id}): ${m.description}`).join('\n')}

When analyzing a business:
1. Consider the industry, size, and stage of the business
2. Match challenges with module capabilities
3. Factor in technical maturity and budget constraints
4. Prioritize based on immediate needs and long-term value
5. Provide specific, actionable insights

Always respond in valid JSON format matching the requested schema.`

// Analyze business profile and generate recommendations
export async function analyzeBusinessProfile(profile: BusinessProfile): Promise<AIAnalysisResult> {
  const prompt = `Analyze this business profile and provide software recommendations:

Industry: ${profile.industry} ${profile.subIndustry ? `(${profile.subIndustry})` : ''}
Company Size: ${profile.companySize}
Employees: ${profile.employeeCountRange}
Annual Revenue: ${profile.annualRevenueRange}
Business Stage: ${profile.businessStage}
Geographic Scope: ${profile.geographicScope}

Primary Goals:
${profile.primaryGoals.map(g => `- ${g}`).join('\n')}

Current Challenges:
${profile.currentChallenges.map(c => `- ${c}`).join('\n')}

Existing Tools: ${profile.existingTools.join(', ') || 'None specified'}
Technical Maturity: ${profile.technicalMaturity}
Budget Range: ${profile.budgetRange}
Timeline: ${profile.timelineUrgency}
Compliance Requirements: ${profile.complianceRequirements.join(', ') || 'None specified'}

Provide:
1. Module recommendations with scores (0-100), reasoning, benefits, ROI estimate, and implementation complexity
2. Industry-specific insights (market trends, benchmarks, best practices)
3. Overall analysis summary
4. Confidence score (0-1) based on data completeness
5. Suggested next steps

Respond in this exact JSON format:
{
  "recommendations": [
    {
      "moduleId": "string",
      "moduleName": "string",
      "score": number,
      "reasoning": "string",
      "keyBenefits": ["string"],
      "estimatedROI": "string",
      "implementationComplexity": "low|medium|high",
      "priorityRank": number
    }
  ],
  "industryInsights": [
    {
      "category": "trend|benchmark|best-practice|opportunity|risk",
      "title": "string",
      "description": "string",
      "data": {},
      "relevanceScore": number
    }
  ],
  "overallAnalysis": "string",
  "confidenceScore": number,
  "suggestedNextSteps": ["string"]
}`

  try {
    const result = await generateText({
      model: mistralModel,
      system: SYSTEM_PROMPT,
      prompt,
      temperature: 0.3,
    })

    // Parse the JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response")
    }

    const analysis = JSON.parse(jsonMatch[0]) as AIAnalysisResult
    return analysis
  } catch (error) {
    console.error("[v0] AI analysis error:", error)
    // Return fallback recommendations based on industry
    return generateFallbackRecommendations(profile)
  }
}

// Generate industry intelligence based on selected modules
export async function generateIndustryIntelligence(
  industry: string,
  selectedModules: string[],
  existingInsights: IndustryInsight[] = []
): Promise<IndustryInsight[]> {
  const prompt = `Generate detailed industry intelligence for a ${industry} business using these modules: ${selectedModules.join(', ')}.

Existing insights to build upon:
${existingInsights.length > 0 ? existingInsights.map(i => `- ${i.title}: ${i.description}`).join('\n') : 'None yet'}

Generate 5-7 NEW insights that would help this business succeed. Focus on:
1. Market trends and forecasts
2. Competitive benchmarks
3. Regulatory updates
4. Technology adoption rates
5. Best practices from industry leaders
6. Emerging opportunities
7. Potential risks to monitor

Respond in JSON format:
{
  "insights": [
    {
      "category": "trend|benchmark|best-practice|opportunity|risk|regulation",
      "title": "string",
      "description": "string (2-3 sentences)",
      "data": { "metric": "value", "source": "string", "date": "string" },
      "relevanceScore": number (0-1)
    }
  ]
}`

  try {
    const result = await generateText({
      model: mistralModel,
      system: "You are an industry research analyst providing actionable business intelligence. Always respond in valid JSON.",
      prompt,
      temperature: 0.5,
    })

    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return []
    }

    const parsed = JSON.parse(jsonMatch[0])
    return parsed.insights || []
  } catch (error) {
    console.error("[v0] Industry intelligence error:", error)
    return []
  }
}

// Stream AI analysis for real-time feedback
export async function streamBusinessAnalysis(profile: BusinessProfile) {
  const prompt = `Analyze this ${profile.industry} business (${profile.companySize}, ${profile.businessStage} stage) with goals: ${profile.primaryGoals.join(', ')}. 
  
Challenges: ${profile.currentChallenges.join(', ')}.

Provide a conversational analysis of their needs and initial recommendations.`

  return streamText({
    model: mistralModel,
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.4,
  })
}

// Process user feedback to improve recommendations
export async function processLearningFeedback(
  feedback: {
    recommendationId: string
    moduleId: string
    wasHelpful: boolean
    feedbackText?: string
    userAction: "selected" | "dismissed" | "viewed"
  },
  existingProfile: BusinessProfile
): Promise<{ adjustedWeights: Record<string, number>; learningInsight: string }> {
  // This would typically update a ML model, but for now we use heuristics
  const adjustedWeights: Record<string, number> = {}
  
  if (feedback.wasHelpful && feedback.userAction === "selected") {
    // Increase weight for this module and similar industries
    adjustedWeights[feedback.moduleId] = 1.2
  } else if (!feedback.wasHelpful || feedback.userAction === "dismissed") {
    // Decrease weight
    adjustedWeights[feedback.moduleId] = 0.8
  }

  const learningInsight = `User ${feedback.userAction} ${feedback.moduleId} module. ${
    feedback.wasHelpful ? "Positive" : "Negative"
  } feedback recorded for ${existingProfile.industry} industry.`

  return { adjustedWeights, learningInsight }
}

// Fallback recommendations when AI is unavailable
function generateFallbackRecommendations(profile: BusinessProfile): AIAnalysisResult {
  const industryLower = profile.industry.toLowerCase()
  
  // Score modules based on industry match
  const recommendations: ModuleRecommendation[] = AVAILABLE_MODULES
    .map((module, index) => {
      let score = 50 // Base score
      
      // Industry matching
      if (module.industries.includes("all") || module.industries.some(i => industryLower.includes(i))) {
        score += 30
      }
      
      // Challenge matching
      const challengeKeywords = profile.currentChallenges.join(" ").toLowerCase()
      module.capabilities.forEach(cap => {
        if (challengeKeywords.includes(cap.replace("-", " "))) {
          score += 10
        }
      })

      return {
        moduleId: module.id,
        moduleName: module.name,
        score: Math.min(score, 100),
        reasoning: `${module.name} is recommended based on your ${profile.industry} industry focus and business goals.`,
        keyBenefits: [
          `Tailored for ${profile.industry} businesses`,
          `Addresses ${profile.currentChallenges[0] || "operational efficiency"}`,
          `Scales with your ${profile.companySize} organization`
        ],
        estimatedROI: "15-25% efficiency improvement",
        implementationComplexity: profile.technicalMaturity === "advanced" ? "low" as const : "medium" as const,
        priorityRank: index + 1
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((r, i) => ({ ...r, priorityRank: i + 1 }))

  return {
    recommendations,
    industryInsights: [
      {
        category: "trend",
        title: `${profile.industry} Digital Transformation`,
        description: `Companies in ${profile.industry} are increasingly adopting AI-driven solutions for competitive advantage.`,
        data: { adoptionRate: "67%", growthRate: "23% YoY" },
        relevanceScore: 0.85
      }
    ],
    overallAnalysis: `Based on your ${profile.companySize} ${profile.industry} business at the ${profile.businessStage} stage, we recommend focusing on solutions that address your primary challenges while supporting your growth goals.`,
    confidenceScore: 0.7,
    suggestedNextSteps: [
      "Complete the detailed questionnaire for refined recommendations",
      "Schedule a demo of top recommended modules",
      "Review industry benchmarks in your dashboard"
    ]
  }
}
