interface LeadInput {
  id: string
  engagementScore?: number
  firmographicsScore?: number
  intentScore?: number
  companySize?: number
  industry?: string
  recentActivity?: string
  lastContacted?: string
  emailOpens?: number
  whatsappEngagement?: number
}

interface LeadScore extends LeadInput {
  score: number
}

export interface LeadScoreResult {
  score: number
  category: "cold" | "warm" | "hot"
  priority: "low" | "medium" | "high" | "critical"
  factors: {
    engagement: number
    firmographics: number
    intent: number
  }
}

/**
 * Calculates lead score based on engagement, firmographics, and intent signals.
 */
export function calculateLeadScore(lead: LeadInput): number {
  let score = 0

  // Engagement score (0-40)
  score += Math.min(40, (lead.engagementScore || 0) * 0.4)

  // Firmographics score (0-30)
  score += Math.min(30, (lead.firmographicsScore || 0) * 0.3)

  // Intent signals score (0-30)
  score += Math.min(30, (lead.intentScore || 0) * 0.3)

  // Company size boost
  if (lead.companySize && lead.companySize > 100) score += 10

  // Industry boost
  if (lead.industry === "technology" || lead.industry === "saas") score += 5

  // Recent activity boost
  if (lead.recentActivity) {
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(lead.recentActivity).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSinceActivity <= 7) score += 10
    else if (daysSinceActivity <= 30) score += 5
  }

  // Communication engagement boost
  if (lead.emailOpens && lead.emailOpens > 5) score += 5
  if (lead.whatsappEngagement && lead.whatsappEngagement > 3) score += 5

  // Cap at 100
  return Math.min(100, Math.round(score))
}

/**
 * Gets high-priority leads (score >= 70).
 */
export function getHighPriorityLeads(leads: LeadInput[]): LeadScore[] {
  return leads
    .map(lead => ({
      ...lead,
      score: calculateLeadScore(lead),
    }))
    .filter(lead => lead.score >= 70)
    .sort((a, b) => b.score - a.score)
}

/**
 * Gets lead scores for a list of leads.
 */
export function getLeadScores(leads: LeadInput[]): LeadScore[] {
  return leads.map(lead => ({
    ...lead,
    score: calculateLeadScore(lead),
  }))
}
