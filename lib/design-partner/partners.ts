import { generateId } from '@/lib/utils/id'

export type DesignPartnerStage = "awareness" | "evaluation" | "pilot" | "launch" | "advocate"

export interface DesignPartner {
  id: string
  name: string
  company: string
  email: string
  stage: DesignPartnerStage
  vertical: string
  feedbackScore: number
  lastTouchpoint: string
  notes: string
}

const INITIAL_PARTNERS: DesignPartner[] = [
  { id: "1", name: "Rajesh Kumar", company: "TechCorp India", email: "rajesh@techcorp.in", stage: "pilot", vertical: "Healthcare", feedbackScore: 88, lastTouchpoint: "2026-07-01", notes: "Testing compliance workspace" },
  { id: "2", name: "Sarah Chen", company: "FinServe Asia", email: "sarah@finserve.sg", stage: "evaluation", vertical: "Banking", feedbackScore: 72, lastTouchpoint: "2026-06-28", notes: "Interested in AI Intelligence" },
  { id: "3", name: "Michael Okafor", company: "Lagos Manufacturing", email: "michael@lagosmfg.ng", stage: "awareness", vertical: "Manufacturing", feedbackScore: 45, lastTouchpoint: "2026-06-25", notes: "Initial demo completed" },
  { id: "4", name: "Ananya Patel", company: "MediChain Health", email: "ananya@medichain.in", stage: "launch", vertical: "Healthcare", feedbackScore: 95, lastTouchpoint: "2026-07-03", notes: "Going live next week" },
  { id: "5", name: "James Wilson", company: "EduTech Global", email: "james@edutech.io", stage: "advocate", vertical: "Education", feedbackScore: 92, lastTouchpoint: "2026-07-02", notes: "Provided testimonial, referring 2 more" },
]

const partners = new Map<string, DesignPartner>(INITIAL_PARTNERS.map(p => [p.id, p]))

export function listPartners(): DesignPartner[] {
  return Array.from(partners.values()).sort((a, b) =>
    new Date(b.lastTouchpoint).getTime() - new Date(a.lastTouchpoint).getTime()
  )
}

export function getPartner(id: string): DesignPartner | undefined {
  return partners.get(id)
}

export function updatePartnerStage(id: string, stage: DesignPartnerStage): DesignPartner | undefined {
  const partner = partners.get(id)
  if (!partner) return undefined
  partner.stage = stage
  partner.lastTouchpoint = new Date().toISOString().split('T')[0]
  return partner
}

export function updatePartnerNotes(id: string, notes: string): DesignPartner | undefined {
  const partner = partners.get(id)
  if (!partner) return undefined
  partner.notes = notes
  partner.lastTouchpoint = new Date().toISOString().split('T')[0]
  return partner
}

export function createPartner(input: Omit<DesignPartner, 'id'>): DesignPartner {
  const partner: DesignPartner = { ...input, id: generateId() }
  partners.set(partner.id, partner)
  return partner
}
