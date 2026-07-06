import { createClient } from "../../lib/supabase/server"

interface Lead {
  id: string
  name: string
  email: string
  engagementScore: number
  firmographics: Record<string, unknown>
  intentSignals: Record<string, unknown>
  workspaceId: string
  createdAt: string
}

/**
 * Calculates lead score based on engagement, firmographics, and intent signals.
 */
export async function calculateLeadScore(leadId: string): Promise<number> {
  const supabase = await createClient()
  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single()

  if (error || !lead) throw new Error("Lead not found")

  // Base score from engagement
  let score = lead.engagementScore || 0

  // Add firmographics boost
  if (lead.firmographics?.companySize === "enterprise") score += 20
  if (lead.firmographics?.industry === "technology") score += 15

  // Add intent signals boost
  if (lead.intentSignals?.visitedPricingPage) score += 10
  if (lead.intentSignals?.requestedDemo) score += 25

  // Cap at 100
  return Math.min(100, score)
}

/**
 * Gets high-priority leads for a workspace.
 */
export async function getHighPriorityLeads(workspaceId: string): Promise<Lead[]> {
  const supabase = await createClient()
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("engagement_score", 70)
    .order("engagement_score", { ascending: false })

  if (error) throw new Error("Failed to fetch leads")

  return leads.map(lead => ({
    id: lead.id,
    name: lead.name,
    email: lead.email,
    engagementScore: lead.engagement_score,
    firmographics: lead.firmographics,
    intentSignals: lead.intent_signals,
    workspaceId: lead.workspace_id,
    createdAt: lead.created_at,
  }))
}

/**
 * Gets lead scores for all leads in a workspace.
 */
export async function getLeadScores(workspaceId: string): Promise<{ leadId: string; score: number }[]> {
  const supabase = await createClient()
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, engagement_score, firmographics, intent_signals")
    .eq("workspace_id", workspaceId)

  if (error) throw new Error("Failed to fetch leads")

  return leads.map(lead => ({
    leadId: lead.id,
    score: calculateLeadScore(lead.id),
  }))
}