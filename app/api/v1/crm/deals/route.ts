"use server";

import { NextResponse } from "next/server";
import { z } from "zod";

// Schemas
const DealSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  value: z.number().min(0),
  probability: z.number().min(0).max(100),
  expectedCloseDate: z.string().datetime(),
  contacts: z.array(z.string()),
  stage: z.enum(["Lead", "Contacted", "Proposal", "Negotiation", "Won", "Lost"]),
});

const DealStageUpdateSchema = z.object({
  dealId: z.string(),
  newStage: z.enum(["Lead", "Contacted", "Proposal", "Negotiation", "Won", "Lost"]),
});

// Mock database (replace with real database)
let deals: z.infer<typeof DealSchema>[] = [];

// Helper to generate ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// GET /api/v1/crm/deals - List all deals
export async function GET() {
  return NextResponse.json(deals);
}

// POST /api/v1/crm/deals - Create a new deal
export async function POST(request: Request) {
  const data = await request.json();
  const parsed = DealSchema.safeParse(data);

  if (!parsed.success) {
    return NextResponse.json(parsed.error, { status: 400 });
  }

  const deal = { ...parsed.data, id: generateId() };
  deals.push(deal);

  return NextResponse.json(deal, { status: 201 });
}

// PATCH /api/v1/crm/deals - Update deal stage
export async function PATCH(request: Request) {
  const data = await request.json();
  const parsed = DealStageUpdateSchema.safeParse(data);

  if (!parsed.success) {
    return NextResponse.json(parsed.error, { status: 400 });
  }

  const { dealId, newStage } = parsed.data;
  const dealIndex = deals.findIndex(d => d.id === dealId);

  if (dealIndex === -1) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  deals[dealIndex] = { ...deals[dealIndex], stage: newStage };

  return NextResponse.json(deals[dealIndex]);
}