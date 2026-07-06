"use server"

import { createServiceClient } from "@/lib/supabase/service"

export interface LeadScoreFactors {
  engagementScore: number // 0-100
  companyFitScore: number // 0-100
  intentScore: number // 0-100
  budgetScore: number // 0-100
  timingScore: number // 0-100
}

export interface LeadScoreResult {
  leadId: string
  overallScore: number // 0-100
  grade: "hot" | "warm" | "cold"
  factors: LeadScoreFactors
  confidence: number
  recommendations: string[]
  lastUpdated: string
}

export async function calculateLeadScore(
  companyId: string
): Promise<LeadScoreResult | null> {
  const supabase = await createServiceClient()

  // Get company data
  const { data: company } = await supabase
    .from("companies")
    .select("*, deals(*)")
    .eq("id", companyId)
    .single()

  if (!company) return null

  // Get engagement history
  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50)

  const deals = (company.deals as Array<Record<string, unknown>>) || []
  const activityList = (activities as Array<Record<string, unknown>>) || []

  // Calculate engagement score
  const recentActivities = activityList.filter(
    a => new Date(a.created_at as string).getTime() > Date.now() - 30 * 86400000
  )
  const emailActivities = recentActivities.filter(a => (a.type as string) === "email").length
  const meetingActivities = recentActivities.filter(a => (a.type as string) === "meeting").length
  const engagementScore = Math.min(100, 
    recentActivities.length * 5 + 
    emailActivities * 10 + 
    meetingActivities * 20
  )

  // Calculate company fit score
  const hasWebsite = company.website ? 20 : 0
  const hasIndustry = company.industry ? 20 : 0
  const hasSize = company.size ? 15 : 0
  const hasPhone = company.phone ? 10 : 0
  const hasAddress = company.address ? 5 : 0
  const companyFitScore = hasWebsite + hasIndustry + hasSize + hasPhone + hasAddress

  // Calculate intent score
  const intentScore = Math.min(100,
    recentActivities.filter(a => (a.type as string) === "demo_request").length * 30 +
    recentActivities.filter(a => (a.type as string) === "pricing_page").length * 15 +
    recentActivities.filter(a => (a.type as string) === "document_download").length * 10
  )

  // Calculate budget score
  const budgetScore = deals.length > 0 
    ? Math.min(100, deals.reduce((sum, d) => sum + ((d.amount as number) || 0), 0) / deals.length / 100)
    : 30

  // Calculate timing score
  const lastActivity = activityList[0]
  const timingScore = lastActivity
    ? Math.max(0, 100 - (Date.now() - new Date(lastActivity.created_at as string).getTime()) / 86400000)
    : 10

  // Weighted overall score
  const factors: LeadScoreFactors = {
    engagementScore,
    companyFitScore,
    intentScore,
    budgetScore,
    timingScore,
  }

  const weights = { engagement: 0.3, companyFit: 0.2, intent: 0.25, budget: 0.15, timing: 0.1 }
  const overallScore = Math.round(
    engagementScore * weights.engagement +
    companyFitScore * weights.companyFit +
    intentScore * weights.intent +
    budgetScore * weights.budget +
    timingScore * weights.timing
  )

  const grade: LeadScoreResult["grade"] = overallScore >= 70 ? "hot" : overallScore >= 40 ? "warm" : "cold"

  // Generate recommendations
  const recommendations: string[] = []
  if (engagementScore < 30) recommendations.push("Increase engagement: schedule a demo or send relevant content")
  if (companyFitScore < 50) recommendations.push("Gather more company information to improve fit assessment")
  if (intentScore < 20) recommendations.push("Low purchase intent detected. Consider nurture campaign")
  if (timingScore < 30) recommendations.push("Re-engage: no recent activity detected")
  if (overallScore >= 70) recommendations.push("High-priority lead: fast-track to sales call")

  return {
    leadId: companyId,
    overallScore,
    grade,
    factors,
    confidence: activityList.length > 10 ? 0.9 : activityList.length > 3 ? 0.7 : 0.5,
    recommendations,
    lastUpdated: new Date().toISOString(),
  }
}

export async function batchScoreLeads(organizationId: string): Promise<LeadScoreResult[]> {
  const supabase = await createServiceClient()

  const { data: companies } = await supabase
    .from("companies")
    .select("id")
    .eq("organization_id", organizationId)

  if (!companies) return []

  const results: LeadScoreResult[] = []
  for (const company of companies) {
    const score = await calculateLeadScore(company.id)
    if (score) results.push(score)
  }

  return results.sort((a, b) => b.overallScore - a.overallScore)
}
