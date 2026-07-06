"use server";

import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateLeadScore, getHighPriorityLeads } from "../../../../../lib/crm/scoring";

// Schema for lead data
const LeadSchema = z.object({
  id: z.string(),
  engagementScore: z.number().min(0).max(100).optional(),
  firmographicsScore: z.number().min(0).max(100).optional(),
  intentScore: z.number().min(0).max(100).optional(),
  companySize: z.number().optional(),
  industry: z.string().optional(),
  recentActivity: z.string().datetime().optional(),
  lastContacted: z.string().datetime().optional(),
  emailOpens: z.number().optional(),
  whatsappEngagement: z.number().optional(),
});

// Schema for lead score update
const LeadScoreUpdateSchema = z.object({
  leadId: z.string(),
  newData: LeadSchema.partial(),
});

// Mock database (replace with real database)
let leads: z.infer<typeof LeadSchema>[] = [];

// GET /api/v1/crm/leads/scores - Get all lead scores
// GET /api/v1/crm/leads/scores?priority=true - Get high-priority leads
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const priorityOnly = searchParams.get("priority") === "true";

  if (priorityOnly) {
    const highPriorityLeads = getHighPriorityLeads(leads);
    return NextResponse.json(highPriorityLeads);
  }

  const leadsWithScores = leads.map(lead => ({
    ...lead,
    score: calculateLeadScore(lead),
  }));

  return NextResponse.json(leadsWithScores);
}

// POST /api/v1/crm/leads/scores - Calculate score for a new lead
export async function POST(request: Request) {
  const data = await request.json();
  const parsed = LeadSchema.safeParse(data);

  if (!parsed.success) {
    return NextResponse.json(parsed.error, { status: 400 });
  }

  const lead = parsed.data;
  leads.push(lead);

  const score = calculateLeadScore(lead);
  return NextResponse.json(score);
}

// PATCH /api/v1/crm/leads/scores - Update lead score with new data
export async function PATCH(request: Request) {
  const data = await request.json();
  const parsed = LeadScoreUpdateSchema.safeParse(data);

  if (!parsed.success) {
    return NextResponse.json(parsed.error, { status: 400 });
  }

  const { leadId, newData } = parsed.data;
  const leadIndex = leads.findIndex(l => l.id === leadId);

  if (leadIndex === -1) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  leads[leadIndex] = { ...leads[leadIndex], ...newData };
  const updatedScore = calculateLeadScore(leads[leadIndex]);

  return NextResponse.json(updatedScore);
}