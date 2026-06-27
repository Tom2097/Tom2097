import { createServiceClient } from "@/lib/supabase/service"
import { generateText } from "ai"
import { z } from "zod"
import { DEFAULT_CHAT_MODEL, BASE_SYSTEM_PROMPT } from "@/lib/ai/config"

/**
 * Module #7.4: Customer Segmentation Engine.
 * 
 * Implements RFM (Recency, Frequency, Monetary) analysis and other
 * segmentation strategies to categorize customers for targeted
 * marketing and analysis. Includes both rule-based and AI-powered segmentation.
 */

// RFM Score ranges (1-5, where 5 is best)
export type RFMScore = 1 | 2 | 3 | 4 | 5

// Customer segment types
export type CustomerSegment = 
  | "champions"
  | "loyal_customers"
  | "potential_loyalists"
  | "new_customers"
  | "promising"
  | "requiring_attention"
  | "about_to_sleep"
  | "sleeping"
  | "at_risk"
  | "churned"
  | "hibernating"

// Segment categories
export type SegmentCategory = 
  | "high_value"
  | "medium_value"
  | "low_value"
  | "active"
  | "inactive"
  | "churned"
  | "new"
  | "vip"

// Customer profile for segmentation
export interface CustomerProfile {
  userId: string
  email?: string
  name?: string
  organizationId: string
  
  // RFM metrics
  recency: number // Days since last activity
  frequency: number // Number of activities/purchases
  monetary: number // Total value spent/generated
  
  // Additional metrics
  firstSeen: string // First activity date
  lastSeen: string // Last activity date
  totalEvents: number
  avgEventValue: number
  maxEventValue: number
  
  // Metadata
  tags?: string[]
  properties?: Record<string, unknown>
}

// Segment definition
export interface SegmentDefinition {
  id: string
  name: string
  description: string
  category: SegmentCategory
  type: CustomerSegment
  color?: string
  icon?: string
  
  // RFM score ranges for this segment
  minRecency?: RFMScore
  maxRecency?: RFMScore
  minFrequency?: RFMScore
  maxFrequency?: RFMScore
  minMonetary?: RFMScore
  maxMonetary?: RFMScore
  
  // Additional conditions
  conditions?: {
    minTotalEvents?: number
    maxTotalEvents?: number
    minMonetaryValue?: number
    maxMonetaryValue?: number
    minRecencyDays?: number
    maxRecencyDays?: number
    tags?: string[]
    mustHaveTags?: string[]
    mustNotHaveTags?: string[]
  }
  
  // AI-generated insights for this segment
  insights?: string[]
  recommendations?: string[]
}

// Segment result
export interface SegmentResult {
  segment: SegmentDefinition
  customers: CustomerProfile[]
  count: number
  totalMonetary: number
  avgMonetary: number
  totalEvents: number
  avgEvents: number
  
  // Metrics about the segment
  metrics: {
    avgRecency: number
    avgFrequency: number
    avgMonetary: number
    retentionRate: number
    churnRisk: number
  }
}

// Segmentation options
export interface SegmentationOptions {
  /** Number of RFM segments to use (3-10) */
  rfmSegments?: number
  /** Lookback period in days */
  lookbackDays?: number
  /** Minimum monetary value to consider */
  minMonetaryValue?: number
  /** Whether to include AI-powered insights */
  useAI?: boolean
  /** Whether to auto-generate segments */
  autoSegment?: boolean
  /** Custom segment definitions */
  customSegments?: SegmentDefinition[]
  /** Events to consider for RFM calculation */
  events?: string[]
  /** Exclude certain users */
  excludeUserIds?: string[]
}

const DEFAULT_OPTIONS: Required<SegmentationOptions> = {
  rfmSegments: 5,
  lookbackDays: 365,
  minMonetaryValue: 0,
  useAI: true,
  autoSegment: true,
  customSegments: [],
  events: [],
  excludeUserIds: [],
}

/**
 * Default RFM segment definitions (5x5x5 = 125 possible combinations)
 * These map RFM scores to customer segments
 */
const DEFAULT_RFM_SEGMENTS: SegmentDefinition[] = [
  {
    id: "champions",
    name: "Champions",
    description: "Best customers - bought recently, buy often and spend the most",
    category: "high_value",
    type: "champions",
    color: "#22c55e",
    icon: "🏆",
    minRecency: 4,
    maxRecency: 5,
    minFrequency: 4,
    maxFrequency: 5,
    minMonetary: 4,
    maxMonetary: 5,
    insights: [
      "Highest value customers",
      "Loyal and engaged",
      "Respond well to loyalty programs",
    ],
    recommendations: [
      "Reward with exclusive offers",
      "Invite to beta programs",
      "Request referrals",
    ],
  },
  {
    id: "loyal_customers",
    name: "Loyal Customers",
    description: "Spend good money and often, but not necessarily recently",
    category: "high_value",
    type: "loyal_customers",
    color: "#14b8a6",
    icon: "💎",
    minRecency: 3,
    maxRecency: 5,
    minFrequency: 4,
    maxFrequency: 5,
    minMonetary: 3,
    maxMonetary: 5,
    conditions: { minTotalEvents: 10 },
    insights: [
      "Long-term loyal customers",
      "Consistent purchasing behavior",
    ],
    recommendations: [
      "Send personalized thank you",
      "Offer subscription options",
      "Provide early access to sales",
    ],
  },
  {
    id: "potential_loyalists",
    name: "Potential Loyalists",
    description: "Recent customers with high spending, but not yet frequent buyers",
    category: "high_value",
    type: "potential_loyalists",
    color: "#06b6d4",
    icon: "🌱",
    minRecency: 4,
    maxRecency: 5,
    minFrequency: 3,
    maxFrequency: 4,
    minMonetary: 4,
    maxMonetary: 5,
    insights: [
      "New but high-value customers",
      "Strong potential for loyalty",
    ],
    recommendations: [
      "Offer loyalty program introduction",
      "Send welcome series",
      "Provide onboarding support",
    ],
  },
  {
    id: "new_customers",
    name: "New Customers",
    description: "First-time buyers or very recent signups",
    category: "new",
    type: "new_customers",
    color: "#84cc16",
    icon: "🌱",
    minRecency: 4,
    maxRecency: 5,
    minFrequency: 1,
    maxFrequency: 2,
    insights: [
      "Recently acquired",
      "High potential for growth",
    ],
    recommendations: [
      "Send onboarding sequence",
      "Offer first-purchase discount",
      "Request feedback",
    ],
  },
  {
    id: "promising",
    name: "Promising",
    description: "Recent activity with low spending, showing potential",
    category: "medium_value",
    type: "promising",
    color: "#eab308",
    icon: "✨",
    minRecency: 4,
    maxRecency: 5,
    minFrequency: 1,
    maxFrequency: 3,
    minMonetary: 1,
    maxMonetary: 3,
    insights: [
      "Engaged but low spenders",
      "Potential to upsell",
    ],
    recommendations: [
      "Offer upsell opportunities",
      "Send educational content",
      "Provide product demonstrations",
    ],
  },
  {
    id: "requiring_attention",
    name: "Requiring Attention",
    description: "Good spenders but haven't purchased recently",
    category: "medium_value",
    type: "requiring_attention",
    color: "#f97316",
    icon: "⚠️",
    minRecency: 2,
    maxRecency: 3,
    minFrequency: 3,
    maxFrequency: 5,
    minMonetary: 3,
    maxMonetary: 5,
    insights: [
      "At risk of churning",
      "Previously high-value",
    ],
    recommendations: [
      "Send win-back campaign",
      "Offer exclusive discount",
      "Request feedback on satisfaction",
    ],
  },
  {
    id: "about_to_sleep",
    name: "About to Sleep",
    description: "Used to purchase often but haven't in a while",
    category: "inactive",
    type: "about_to_sleep",
    color: "#f59e0b",
    icon: "😴",
    minRecency: 2,
    maxRecency: 3,
    minFrequency: 2,
    maxFrequency: 4,
    insights: [
      "Declining engagement",
      "At risk of becoming inactive",
    ],
    recommendations: [
      "Send re-engagement campaign",
      "Highlight new features",
      "Offer limited-time incentives",
    ],
  },
  {
    id: "sleeping",
    name: "Sleeping",
    description: "Haven't purchased in a long time but were once active",
    category: "inactive",
    type: "sleeping",
    color: "#6b7280",
    icon: "😴",
    minRecency: 1,
    maxRecency: 2,
    minFrequency: 1,
    maxFrequency: 3,
    insights: [
      "Inactive customers",
      "May need strong incentive to return",
    ],
    recommendations: [
      "Send win-back offer",
      "Survey about reasons for leaving",
      "Consider targeted advertising",
    ],
  },
  {
    id: "at_risk",
    name: "At Risk",
    description: "Low spending and frequency, haven't purchased recently",
    category: "low_value",
    type: "at_risk",
    color: "#ef4444",
    icon: "🔥",
    minRecency: 1,
    maxRecency: 2,
    minFrequency: 1,
    maxFrequency: 2,
    minMonetary: 1,
    maxMonetary: 2,
    insights: [
      "High churn risk",
      "Low engagement",
    ],
    recommendations: [
      "Send urgent win-back campaign",
      "Investigate satisfaction issues",
      "Consider last chance offers",
    ],
  },
  {
    id: "churned",
    name: "Churned",
    description: "No activity for a very long time",
    category: "churned",
    type: "churned",
    color: "#7f1d1d",
    icon: "💀",
    minRecency: 1,
    maxRecency: 1,
    minFrequency: 1,
    maxFrequency: 1,
    conditions: { minRecencyDays: 180 },
    insights: [
      "Lost customers",
      "Very low probability of return",
    ],
    recommendations: [
      "Consider removal from active marketing",
      "Use for lookalike audience targeting",
      "Analyze reasons for churn",
    ],
  },
  {
    id: "hibernating",
    name: "Hibernating",
    description: "No activity for an extended period, but were once valuable",
    category: "churned",
    type: "hibernating",
    color: "#4b5563",
    icon: "❄️",
    minRecency: 1,
    maxRecency: 1,
    minFrequency: 3,
    maxFrequency: 5,
    conditions: { minRecencyDays: 90, maxRecencyDays: 365 },
    insights: [
      "Long-term inactive",
      "Previously valuable",
    ],
    recommendations: [
      "Send seasonal re-engagement",
      "Offer special return incentive",
    ],
  },
]

/**
 * Calculate RFM scores for a customer
 * Returns scores from 1-5 for Recency, Frequency, and Monetary
 */
function calculateRFMScores(
  profile: CustomerProfile,
  allProfiles: CustomerProfile[],
  lookbackDays: number = 365
): { recencyScore: RFMScore; frequencyScore: RFMScore; monetaryScore: RFMScore } {
  
  // Get quartiles for scoring
  const recencies = allProfiles.map(p => p.recency).filter(r => !isNaN(r))
  const frequencies = allProfiles.map(p => p.frequency).filter(f => !isNaN(f))
  const monetaryValues = allProfiles.map(p => p.monetary).filter(m => !isNaN(m))
  
  // Sort and get quartiles
  const sortedRecencies = [...recencies].sort((a, b) => a - b)
  const sortedFrequencies = [...frequencies].sort((a, b) => a - b)
  const sortedMonetary = [...monetaryValues].sort((a, b) => a - b)
  
  const getQuartileScore = (value: number, sortedValues: number[]): RFMScore => {
    if (sortedValues.length === 0) return 3
    
    const q1 = sortedValues[Math.floor(sortedValues.length * 0.2)]
    const q2 = sortedValues[Math.floor(sortedValues.length * 0.4)]
    const q3 = sortedValues[Math.floor(sortedValues.length * 0.6)]
    const q4 = sortedValues[Math.floor(sortedValues.length * 0.8)]
    
    if (value <= q1) return 5
    if (value <= q2) return 4
    if (value <= q3) return 3
    if (value <= q4) return 2
    return 1
  }
  
  // For recency, lower is better (more recent)
  const recencyScore = ((): RFMScore => {
    if (profile.recency <= lookbackDays * 0.2) return 5
    if (profile.recency <= lookbackDays * 0.4) return 4
    if (profile.recency <= lookbackDays * 0.6) return 3
    if (profile.recency <= lookbackDays * 0.8) return 2
    return 1
  })()
  
  // For frequency and monetary, higher is better
  const frequencyScore = getQuartileScore(profile.frequency, sortedFrequencies)
  const monetaryScore = getQuartileScore(profile.monetary, sortedMonetary)
  
  return { recencyScore, frequencyScore, monetaryScore }
}

/**
 * Calculate RFM cell (recency + frequency + monetary as string)
 */
function getRFMCell(
  recencyScore: RFMScore,
  frequencyScore: RFMScore,
  monetaryScore: RFMScore
): string {
  return `${recencyScore}${frequencyScore}${monetaryScore}`
}

/**
 * Assign customer to segment based on RFM scores
 */
function assignSegment(
  rfmScores: { recencyScore: RFMScore; frequencyScore: RFMScore; monetaryScore: RFMScore },
  profile: CustomerProfile,
  segments: SegmentDefinition[] = DEFAULT_RFM_SEGMENTS
): SegmentDefinition | null {
  
  for (const segment of segments) {
    // Check RFM score ranges
    if (segment.minRecency && rfmScores.recencyScore < segment.minRecency) continue
    if (segment.maxRecency && rfmScores.recencyScore > segment.maxRecency) continue
    if (segment.minFrequency && rfmScores.frequencyScore < segment.minFrequency) continue
    if (segment.maxFrequency && rfmScores.frequencyScore > segment.maxFrequency) continue
    if (segment.minMonetary && rfmScores.monetaryScore < segment.minMonetary) continue
    if (segment.maxMonetary && rfmScores.monetaryScore > segment.maxMonetary) continue
    
    // Check additional conditions
    const conditions = segment.conditions || {}
    if (conditions.minTotalEvents && profile.totalEvents < conditions.minTotalEvents) continue
    if (conditions.maxTotalEvents && profile.totalEvents > conditions.maxTotalEvents) continue
    if (conditions.minMonetaryValue && profile.monetary < conditions.minMonetaryValue) continue
    if (conditions.maxMonetaryValue && profile.monetary > conditions.maxMonetaryValue) continue
    if (conditions.minRecencyDays && profile.recency < conditions.minRecencyDays) continue
    if (conditions.maxRecencyDays && profile.recency > conditions.maxRecencyDays) continue
    
    if (conditions.tags) {
      const hasTag = profile.tags && conditions.tags.some(tag => profile.tags!.includes(tag))
      if (!hasTag) continue
    }
    
    if (conditions.mustHaveTags) {
      const hasAllTags = profile.tags && conditions.mustHaveTags.every(tag => profile.tags!.includes(tag))
      if (!hasAllTags) continue
    }
    
    if (conditions.mustNotHaveTags) {
      const hasNoTags = profile.tags && conditions.mustNotHaveTags.every(tag => !profile.tags!.includes(tag))
      if (!hasNoTags) continue
    }
    
    return segment
  }
  
  return null
}

/**
 * Get customer profiles from analytics data
 */
async function getCustomerProfiles(
  organizationId: string,
  lookbackDays: number = 365,
  events: string[] = []
): Promise<CustomerProfile[]> {
  
  try {
    const db = createServiceClient()
    
    // Get all analytics events for the organization
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString()
    const endDate = new Date().toISOString()
    
    let query = db
      .from("analytics_events")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("occurred_at", startDate)
      .lte("occurred_at", endDate)
    
    // Filter by specific events if provided
    if (events.length > 0) {
      query = query.in("event_name", events)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error("[Customer Segments] Error fetching events:", error.message)
      return []
    }
    
    const eventsData = data ?? []
    
    // Group by user
    const userEvents: Record<string, typeof eventsData> = {}
    for (const event of eventsData) {
      const userId = event.user_id || "anonymous"
      if (!userEvents[userId]) {
        userEvents[userId] = []
      }
      userEvents[userId].push(event)
    }
    
    // Build customer profiles
    const profiles: CustomerProfile[] = []
    
    for (const [userId, events] of Object.entries(userEvents)) {
      if (events.length === 0) continue
      
      // Sort events by date
      const sortedEvents = events.sort((a, b) => 
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
      )
      
      const firstEvent = sortedEvents[0]
      const lastEvent = sortedEvents[sortedEvents.length - 1]
      
      // Calculate metrics
      const recency = Math.floor(
        (new Date().getTime() - new Date(lastEvent.occurred_at).getTime()) / (1000 * 60 * 60 * 24)
      )
      
      const frequency = events.length
      const monetary = sortedEvents.reduce((sum, e) => sum + (e.value || 0), 0)
      
      // Calculate RFM values
      const avgEventValue = monetary / frequency
      const maxEventValue = Math.max(...sortedEvents.map(e => e.value || 0))
      
      // Extract tags from properties
      const tags: string[] = []
      for (const event of events) {
        if (event.properties && typeof event.properties === "object") {
          const props = event.properties as Record<string, unknown>
          if (props.tags && Array.isArray(props.tags)) {
            tags.push(...props.tags.filter((t: unknown) => typeof t === "string") as string[])
          }
        }
      }
      
      const profile: CustomerProfile = {
        userId,
        organizationId,
        recency,
        frequency,
        monetary,
        firstSeen: firstEvent.occurred_at,
        lastSeen: lastEvent.occurred_at,
        totalEvents: frequency,
        avgEventValue,
        maxEventValue,
        tags: tags.length > 0 ? Array.from(new Set(tags)) : undefined,
        properties: {},
      }
      
      profiles.push(profile)
    }
    
    return profiles
    
  } catch (error) {
    console.error("[Customer Segments] Error getting customer profiles:", error)
    return []
  }
}

/**
 * Main segmentation function
 */
export async function segmentCustomers(
  organizationId: string,
  options: SegmentationOptions = {}
): Promise<{ segments: SegmentResult[]; totalCustomers: number; summary: { segments: number; avgCustomersPerSegment: number; topSegment: string } }> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  // Get customer profiles
  const profiles = await getCustomerProfiles(
    organizationId,
    opts.lookbackDays!,
    opts.events!
  )
  
  // Filter out excluded users
  const filteredProfiles = profiles.filter(p => !opts.excludeUserIds!.includes(p.userId))
  
  if (filteredProfiles.length === 0) {
    return {
      segments: [],
      totalCustomers: 0,
      summary: { segments: 0, avgCustomersPerSegment: 0, topSegment: "" },
    }
  }
  
  // Calculate RFM scores for all customers
  const allProfiles = filteredProfiles
  
  // Assign segments to each customer
  const customerSegments: Map<string, { profile: CustomerProfile; segment: SegmentDefinition | null }> = new Map()
  
  for (const profile of allProfiles) {
    const scores = calculateRFMScores(profile, allProfiles, opts.lookbackDays!)
    const segment = assignSegment(scores, profile, opts.customSegments?.length ? opts.customSegments : DEFAULT_RFM_SEGMENTS)
    customerSegments.set(profile.userId, { profile, segment })
  }
  
  // Group customers by segment
  const segmentMap: Map<string, { segment: SegmentDefinition; customers: CustomerProfile[] }> = new Map()
  
  for (const [userId, data] of customerSegments) {
    const { profile, segment } = data
    
    if (!segment) continue
    
    if (!segmentMap.has(segment.id)) {
      segmentMap.set(segment.id, { segment, customers: [] })
    }
    
    const segmentData = segmentMap.get(segment.id)!
    segmentData.customers.push(profile)
  }
  
  // Build segment results
  const segmentResults: SegmentResult[] = []
  
  for (const [segmentId, data] of segmentMap) {
    const { segment, customers } = data
    
    // Calculate metrics for the segment
    const totalMonetary = customers.reduce((sum, c) => sum + c.monetary, 0)
    const totalEvents = customers.reduce((sum, c) => sum + c.totalEvents, 0)
    const avgRecency = customers.reduce((sum, c) => sum + c.recency, 0) / customers.length
    const avgFrequency = customers.reduce((sum, c) => sum + c.frequency, 0) / customers.length
    const avgMonetary = totalMonetary / customers.length
    
    // Calculate retention rate (percentage of customers still active)
    const activeCustomers = customers.filter(c => c.recency <= opts.lookbackDays! * 0.3).length
    const retentionRate = (activeCustomers / customers.length) * 100
    
    // Calculate churn risk (percentage of customers at risk)
    const atRiskCustomers = customers.filter(c => c.recency > opts.lookbackDays! * 0.7).length
    const churnRisk = (atRiskCustomers / customers.length) * 100
    
    const segmentResult: SegmentResult = {
      segment,
      customers,
      count: customers.length,
      totalMonetary,
      avgMonetary,
      totalEvents,
      avgEvents: totalEvents / customers.length,
      metrics: {
        avgRecency,
        avgFrequency,
        avgMonetary,
        retentionRate,
        churnRisk,
      },
    }
    
    segmentResults.push(segmentResult)
  }
  
  // Sort by count (largest segments first)
  const sortedSegments = segmentResults.sort((a, b) => b.count - a.count)
  
  // Add AI insights if enabled
  if (opts.useAI) {
    const segmentsWithAI = await addAIInsightsToSegments(sortedSegments, organizationId)
    return {
      segments: segmentsWithAI,
      totalCustomers: filteredProfiles.length,
      summary: {
        segments: sortedSegments.length,
        avgCustomersPerSegment: filteredProfiles.length / sortedSegments.length,
        topSegment: sortedSegments[0]?.segment.name || "",
      },
    }
  }
  
  return {
    segments: sortedSegments,
    totalCustomers: filteredProfiles.length,
    summary: {
      segments: sortedSegments.length,
      avgCustomersPerSegment: filteredProfiles.length / sortedSegments.length,
      topSegment: sortedSegments[0]?.segment.name || "",
    },
  }
}

/**
 * Add AI-generated insights to segments
 */
async function addAIInsightsToSegments(
  segments: SegmentResult[],
  organizationId: string
): Promise<SegmentResult[]> {
  
  for (const segment of segments) {
    try {
      const AI_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are a customer analytics expert. Based on the following customer segment data, provide actionable insights and recommendations.

Segment: ${segment.segment.name}
Description: ${segment.segment.description}
Customer Count: ${segment.count}
Total Revenue: $${segment.totalMonetary.toLocaleString()}
Average Revenue per Customer: $${segment.avgMonetary.toLocaleString()}
Average Recency: ${segment.metrics.avgRecency.toFixed(1)} days
Average Frequency: ${segment.metrics.avgFrequency.toFixed(1)}
Retention Rate: ${segment.metrics.retentionRate.toFixed(1)}%
Churn Risk: ${segment.metrics.churnRisk.toFixed(1)}%

Return ONLY a JSON object with:
{
  "insights": ["insight 1", "insight 2", "insight 3"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}`

      const prompt = AI_SYSTEM_PROMPT
      
      const result = await generateText({
        model: DEFAULT_CHAT_MODEL,
        system: AI_SYSTEM_PROMPT,
        prompt: prompt,
        temperature: 0.3,
        maxOutputTokens: 1000,
      })
      
      // Parse response
      try {
        const responseText = result.text
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          
          // Update segment definition with AI insights
          const updatedSegment: SegmentDefinition = {
            ...segment.segment,
            insights: [...(segment.segment.insights || []), ...(parsed.insights || [])],
            recommendations: [...(segment.segment.recommendations || []), ...(parsed.recommendations || [])],
          }
          
          segment.segment = updatedSegment
        }
      } catch (error) {
        console.error("[Customer Segments] Error parsing AI response:", error)
      }
      
    } catch (error) {
      console.error("[Customer Segments] Error generating AI insights:", error)
    }
  }
  
  return segments
}

/**
 * Get a single customer's segment
 */
export async function getCustomerSegment(
  organizationId: string,
  userId: string,
  options: SegmentationOptions = {}
): Promise<{ profile?: CustomerProfile; segment?: SegmentDefinition; rfmScores?: { recencyScore: RFMScore; frequencyScore: RFMScore; monetaryScore: RFMScore } } | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  // Get all profiles to calculate RFM scores
  const allProfiles = await getCustomerProfiles(
    organizationId,
    opts.lookbackDays!,
    opts.events!
  )
  
  if (allProfiles.length === 0) return null
  
  // Find the specific customer
  const profile = allProfiles.find(p => p.userId === userId)
  
  if (!profile) return null
  
  // Calculate RFM scores
  const scores = calculateRFMScores(profile, allProfiles, opts.lookbackDays!)
  
  // Assign segment
  const segment = assignSegment(scores, profile, opts.customSegments?.length ? opts.customSegments : DEFAULT_RFM_SEGMENTS)

  return { profile, segment: segment ?? undefined, rfmScores: scores }
}

/**
 * Get RFM distribution for all customers
 */
export async function getRFMDistribution(
  organizationId: string,
  options: SegmentationOptions = {}
): Promise<{
  recency: Record<RFMScore, number>
  frequency: Record<RFMScore, number>
  monetary: Record<RFMScore, number>
  cells: Record<string, number>
}> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const profiles = await getCustomerProfiles(
    organizationId,
    opts.lookbackDays!,
    opts.events!
  )
  
  if (profiles.length === 0) {
    return {
      recency: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      frequency: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      monetary: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      cells: {},
    }
  }
  
  const recency: Record<RFMScore, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const frequency: Record<RFMScore, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const monetary: Record<RFMScore, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const cells: Record<string, number> = {}
  
  for (const profile of profiles) {
    const scores = calculateRFMScores(profile, profiles, opts.lookbackDays!)
    
    // Update individual scores
    recency[scores.recencyScore] = (recency[scores.recencyScore] || 0) + 1
    frequency[scores.frequencyScore] = (frequency[scores.frequencyScore] || 0) + 1
    monetary[scores.monetaryScore] = (monetary[scores.monetaryScore] || 0) + 1
    
    // Update cell count
    const cell = getRFMCell(scores.recencyScore, scores.frequencyScore, scores.monetaryScore)
    cells[cell] = (cells[cell] || 0) + 1
  }
  
  return { recency, frequency, monetary, cells }
}

/**
 * Create custom segments based on specific criteria
 */
export async function createCustomSegments(
  organizationId: string,
  criteria: {
    name: string
    description: string
    category: SegmentCategory
    conditions: {
      minRecency?: number
      maxRecency?: number
      minFrequency?: number
      maxFrequency?: number
      minMonetary?: number
      maxMonetary?: number
      minTotalEvents?: number
      maxTotalEvents?: number
      tags?: string[]
      mustHaveTags?: string[]
      mustNotHaveTags?: string[]
    }
  }[],
  options: SegmentationOptions = {}
): Promise<SegmentDefinition[]> {
  
  const segments: SegmentDefinition[] = criteria.map((criterion, index) => ({
    id: `custom_${index}_${Date.now()}`,
    name: criterion.name,
    description: criterion.description,
    category: criterion.category,
    type: criterion.name.toLowerCase().replace(/\s+/g, "_") as CustomerSegment,
    conditions: criterion.conditions,
  }))
  
  // Validate and get counts for each segment
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const profiles = await getCustomerProfiles(
    organizationId,
    opts.lookbackDays!,
    opts.events!
  )
  
  // Filter out excluded users
  const filteredProfiles = profiles.filter(p => !opts.excludeUserIds!.includes(p.userId))
  
  for (const segment of segments) {
    const matchingProfiles = filteredProfiles.filter(profile => {
      const conditions = (segment.conditions || {}) as Record<string, number | string | string[] | undefined>
      
      if (conditions.minRecency && (profile.recency as number) < (conditions.minRecency as number)) return false
      if (conditions.maxRecency && (profile.recency as number) > (conditions.maxRecency as number)) return false
      if (conditions.minFrequency && (profile.frequency as number) < (conditions.minFrequency as number)) return false
      if (conditions.maxFrequency && (profile.frequency as number) > (conditions.maxFrequency as number)) return false
      if (conditions.minMonetary && (profile.monetary as number) < (conditions.minMonetary as number)) return false
      if (conditions.maxMonetary && (profile.monetary as number) > (conditions.maxMonetary as number)) return false
      if (conditions.minTotalEvents && (profile.totalEvents as number) < (conditions.minTotalEvents as number)) return false
      if (conditions.maxTotalEvents && (profile.totalEvents as number) > (conditions.maxTotalEvents as number)) return false
      
      const tags = conditions.tags as string[] | undefined
      const mustHaveTags = conditions.mustHaveTags as string[] | undefined
      const mustNotHaveTags = conditions.mustNotHaveTags as string[] | undefined
      if (tags) {
        const hasTag = profile.tags && tags.some(tag => profile.tags!.includes(tag))
        if (!hasTag) return false
      }
      
      if (mustHaveTags) {
        const hasAllTags = profile.tags && mustHaveTags.every(tag => profile.tags!.includes(tag))
        if (!hasAllTags) return false
      }
      
      if (mustNotHaveTags) {
        const hasNoTags = profile.tags && mustNotHaveTags.every(tag => !profile.tags!.includes(tag))
        if (!hasNoTags) return false
      }
      
      return true
    })
    
    segment.insights = [
      `${matchingProfiles.length} customers match this segment`,
      `Total value: $${matchingProfiles.reduce((sum, p) => sum + p.monetary, 0).toLocaleString()}`,
    ]
  }
  
  return segments
}

/**
 * Get segment comparison metrics
 */
export async function getSegmentComparison(
  organizationId: string,
  options: SegmentationOptions = {}
): Promise<{
  segments: { name: string; count: number; avgMonetary: number; retentionRate: number; churnRisk: number }[]
  overall: { totalCustomers: number; totalMonetary: number; avgMonetary: number; avgRetentionRate: number }
}> {
  const result = await segmentCustomers(organizationId, options)
  
  const segments = result.segments.map(s => ({
    name: s.segment.name,
    count: s.count,
    avgMonetary: s.avgMonetary,
    retentionRate: s.metrics.retentionRate,
    churnRisk: s.metrics.churnRisk,
  }))
  
  const totalCustomers = result.totalCustomers
  const totalMonetary = result.segments.reduce((sum, s) => sum + s.totalMonetary, 0)
  const avgMonetary = totalCustomers > 0 ? totalMonetary / totalCustomers : 0
  const avgRetentionRate = result.segments.reduce((sum, s) => sum + s.metrics.retentionRate, 0) / result.segments.length
  
  return {
    segments,
    overall: {
      totalCustomers,
      totalMonetary,
      avgMonetary,
      avgRetentionRate,
    },
  }
}

export {
  DEFAULT_RFM_SEGMENTS,
  calculateRFMScores,
  assignSegment,
  getRFMCell,
}
