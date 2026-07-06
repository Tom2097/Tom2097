"use strict";

import { z } from "zod";

// Schema for lead data
const LeadSchema = z.object({
  id: z.string(),
  engagementScore: z.number().min(0).max(100).optional(),
  firmographicsScore: z.number().min(0).max(100).optional(),
  intentScore: z.number().min(0).max(100).optional(),
  companySize: z.number().optional(),
  industry: z.string().optional(),
  recentActivity: z.date().optional(),
  lastContacted: z.date().optional(),
  emailOpens: z.number().optional(),
  whatsappEngagement: z.number().optional(),
});

export type Lead = z.infer<typeof LeadSchema>;

// Schema for lead score result
const LeadScoreResultSchema = z.object({
  leadId: z.string(),
  score: z.number().min(0).max(100),
  priority: z.enum(["low", "medium", "high", "critical"]),
  factors: z.record(z.string(), z.number()),
});

export type LeadScoreResult = z.infer<typeof LeadScoreResultSchema>;

/**
 * Calculates lead score based on engagement, firmographics, and intent signals.
 * @param lead - Lead data
 * @returns LeadScoreResult
 */
export const calculateLeadScore = (lead: Lead): LeadScoreResult => {
  const engagementScore = lead.engagementScore || 0;
  const firmographicsScore = lead.firmographicsScore || 0;
  const intentScore = lead.intentScore || 0;

  // Weighted scoring (adjust weights as needed)
  const score =
    engagementScore * 0.4 +
    firmographicsScore * 0.3 +
    intentScore * 0.3;

  // Determine priority
  let priority: "low" | "medium" | "high" | "critical" = "low";
  if (score >= 80) priority = "critical";
  else if (score >= 60) priority = "high";
  else if (score >= 40) priority = "medium";

  return {
    leadId: lead.id,
    score: Math.round(score),
    priority,
    factors: {
      engagement: engagementScore,
      firmographics: firmographicsScore,
      intent: intentScore,
    },
  };
};

/**
 * Updates lead score in real-time as new data arrives.
 * @param lead - Lead data
 * @param newData - Partial lead data with updates
 * @returns Updated LeadScoreResult
 */
export const updateLeadScore = (lead: Lead, newData: Partial<Lead>): LeadScoreResult => {
  const updatedLead = { ...lead, ...newData };
  return calculateLeadScore(updatedLead);
};

/**
 * Surfaces high-priority leads for sales teams.
 * @param leads - Array of leads
 * @param threshold - Minimum score to consider as high-priority (default: 60)
 * @returns Array of high-priority leads
 */
export const getHighPriorityLeads = (leads: Lead[], threshold = 60): Lead[] => {
  return leads
    .map(lead => ({
      lead,
      score: calculateLeadScore(lead).score,
    }))
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(({ lead }) => lead);
};