import { createServiceClient } from "@/lib/supabase/service"
import {
  ACTIVITY_TYPES,
  CONTACT_STATUSES,
  CRM_ENTITY_TYPES,
  DEAL_STAGES,
  type Activity,
  type ActivityInput,
  type Company,
  type CompanyInput,
  type CompanyUpdateInput,
  type Contact,
  type ContactInput,
  type ContactUpdateInput,
  type CrmEntityType,
  type Deal,
  type DealInput,
  type DealStage,
  type DealUpdateInput,
  type ListActivitiesOptions,
  type ListCompaniesOptions,
  type ListContactsOptions,
  type ListDealsOptions,
  type PipelineStageSummary,
  type PipelineSummary,
} from "./types"

/**
 * Module #17: Customer CRM engine.
 *
 * Writes go through the service client (RLS-exempt) but EVERY function takes an
 * already-validated `organizationId` (resolved by withAuth) and scopes all I/O
 * to it, preserving the multi-tenant boundary. Cross-tenant ids therefore
 * no-op rather than leaking data.
 */

const OPEN_STAGES: DealStage[] = ["lead", "qualified", "proposal", "negotiation"]

function pick<T extends readonly string[]>(allowed: T, v: unknown, fallback: T[number]): T[number] {
  return allowed.includes(v as T[number]) ? (v as T[number]) : fallback
}

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return Array.from(
    new Set(
      tags
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim())
        .slice(0, 50),
    ),
  )
}

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, max)
}

function clampNum(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null
  return v
}

// ── Companies ─────────────────────────────────────────────────────────────────

export function validateCompany(input: unknown): string | null {
  if (!input || typeof input !== "object") return "company must be an object"
  const c = input as CompanyInput
  if (!c.name || typeof c.name !== "string" || !c.name.trim()) return "name is required"
  if (c.name.length > 200) return "name too long (max 200)"
  return null
}

export async function createCompany(
  organizationId: string,
  createdBy: string,
  input: CompanyInput,
): Promise<Company> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_companies")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      owner_id: input.owner_id ?? createdBy,
      name: input.name.trim(),
      domain: clampStr(input.domain, 255),
      industry: clampStr(input.industry, 120),
      website: clampStr(input.website, 255),
      phone: clampStr(input.phone, 60),
      size: clampStr(input.size, 60),
      annual_revenue: clampNum(input.annual_revenue),
      notes: clampStr(input.notes, 5000),
      tags: sanitizeTags(input.tags),
    })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] createCompany failed:", error.message)
    throw new Error("failed to create company")
  }
  return data as Company
}

export async function listCompanies(
  organizationId: string,
  opts: ListCompaniesOptions,
): Promise<{ companies: Company[]; total: number }> {
  const db = createServiceClient()
  let query = db
    .from("crm_companies")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)

  if (opts.search?.trim()) query = query.ilike("name", `%${opts.search.trim()}%`)

  query = query
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)

  const { data, error, count } = await query
  if (error) {
    console.log("[v0] listCompanies failed:", error.message)
    throw new Error("failed to list companies")
  }
  return { companies: (data ?? []) as Company[], total: count ?? 0 }
}

export async function getCompany(organizationId: string, id: string): Promise<Company | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_companies")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()
  if (error) {
    console.log("[v0] getCompany failed:", error.message)
    throw new Error("failed to fetch company")
  }
  return (data as Company) ?? null
}

export async function updateCompany(
  organizationId: string,
  id: string,
  input: CompanyUpdateInput,
): Promise<Company | null> {
  const db = createServiceClient()
  const patch: Record<string, unknown> = {}
  if (typeof input.name === "string") {
    if (!input.name.trim()) throw new Error("name cannot be empty")
    patch.name = input.name.trim().slice(0, 200)
  }
  if (input.domain !== undefined) patch.domain = clampStr(input.domain, 255)
  if (input.industry !== undefined) patch.industry = clampStr(input.industry, 120)
  if (input.website !== undefined) patch.website = clampStr(input.website, 255)
  if (input.phone !== undefined) patch.phone = clampStr(input.phone, 60)
  if (input.size !== undefined) patch.size = clampStr(input.size, 60)
  if (input.annual_revenue !== undefined) patch.annual_revenue = clampNum(input.annual_revenue)
  if (input.notes !== undefined) patch.notes = clampStr(input.notes, 5000)
  if (input.tags !== undefined) patch.tags = sanitizeTags(input.tags)
  if (input.owner_id !== undefined) patch.owner_id = input.owner_id
  if (Object.keys(patch).length === 0) return getCompany(organizationId, id)

  const { data, error } = await db
    .from("crm_companies")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error) {
    console.log("[v0] updateCompany failed:", error.message)
    throw new Error("failed to update company")
  }
  return (data as Company) ?? null
}

export async function deleteCompany(organizationId: string, id: string): Promise<boolean> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_companies")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error) {
    console.log("[v0] deleteCompany failed:", error.message)
    throw new Error("failed to delete company")
  }
  return Boolean(data)
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export function validateContact(input: unknown): string | null {
  if (!input || typeof input !== "object") return "contact must be an object"
  const c = input as ContactInput
  const hasName = (c.first_name && c.first_name.trim()) || (c.last_name && c.last_name.trim())
  if (!hasName && !c.email) return "a name or email is required"
  if (c.email && typeof c.email === "string" && c.email.length > 0 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) {
    return "invalid email"
  }
  if (c.status && !CONTACT_STATUSES.includes(c.status)) return "invalid status"
  return null
}

export async function createContact(
  organizationId: string,
  createdBy: string,
  input: ContactInput,
): Promise<Contact> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_contacts")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      owner_id: input.owner_id ?? createdBy,
      company_id: input.company_id ?? null,
      first_name: (input.first_name ?? "").trim().slice(0, 120),
      last_name: (input.last_name ?? "").trim().slice(0, 120),
      email: clampStr(input.email, 255)?.toLowerCase() ?? null,
      phone: clampStr(input.phone, 60),
      title: clampStr(input.title, 160),
      status: pick(CONTACT_STATUSES, input.status, "lead"),
      notes: clampStr(input.notes, 5000),
      tags: sanitizeTags(input.tags),
    })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] createContact failed:", error.message)
    throw new Error("failed to create contact")
  }
  return data as Contact
}

export async function listContacts(
  organizationId: string,
  opts: ListContactsOptions,
): Promise<{ contacts: Contact[]; total: number }> {
  const db = createServiceClient()
  let query = db
    .from("crm_contacts")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)

  if (opts.status) query = query.eq("status", opts.status)
  if (opts.companyId) query = query.eq("company_id", opts.companyId)
  if (opts.search?.trim()) {
    const s = opts.search.trim()
    query = query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%`)
  }

  query = query
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)

  const { data, error, count } = await query
  if (error) {
    console.log("[v0] listContacts failed:", error.message)
    throw new Error("failed to list contacts")
  }
  return { contacts: (data ?? []) as Contact[], total: count ?? 0 }
}

export async function getContact(organizationId: string, id: string): Promise<Contact | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_contacts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()
  if (error) {
    console.log("[v0] getContact failed:", error.message)
    throw new Error("failed to fetch contact")
  }
  return (data as Contact) ?? null
}

export async function updateContact(
  organizationId: string,
  id: string,
  input: ContactUpdateInput,
): Promise<Contact | null> {
  const db = createServiceClient()
  const patch: Record<string, unknown> = {}
  if (input.company_id !== undefined) patch.company_id = input.company_id
  if (typeof input.first_name === "string") patch.first_name = input.first_name.trim().slice(0, 120)
  if (typeof input.last_name === "string") patch.last_name = input.last_name.trim().slice(0, 120)
  if (input.email !== undefined) patch.email = clampStr(input.email, 255)?.toLowerCase() ?? null
  if (input.phone !== undefined) patch.phone = clampStr(input.phone, 60)
  if (input.title !== undefined) patch.title = clampStr(input.title, 160)
  if (input.status) patch.status = pick(CONTACT_STATUSES, input.status, "lead")
  if (input.notes !== undefined) patch.notes = clampStr(input.notes, 5000)
  if (input.tags !== undefined) patch.tags = sanitizeTags(input.tags)
  if (input.owner_id !== undefined) patch.owner_id = input.owner_id
  if (Object.keys(patch).length === 0) return getContact(organizationId, id)

  const { data, error } = await db
    .from("crm_contacts")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error) {
    console.log("[v0] updateContact failed:", error.message)
    throw new Error("failed to update contact")
  }
  return (data as Contact) ?? null
}

export async function deleteContact(organizationId: string, id: string): Promise<boolean> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_contacts")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error) {
    console.log("[v0] deleteContact failed:", error.message)
    throw new Error("failed to delete contact")
  }
  return Boolean(data)
}

// ── Deals ───────────────────────────────────────────────────────────────────--

export function validateDeal(input: unknown): string | null {
  if (!input || typeof input !== "object") return "deal must be an object"
  const d = input as DealInput
  if (!d.title || typeof d.title !== "string" || !d.title.trim()) return "title is required"
  if (d.title.length > 200) return "title too long (max 200)"
  if (d.stage && !DEAL_STAGES.includes(d.stage)) return "invalid stage"
  if (d.value !== undefined && (typeof d.value !== "number" || d.value < 0)) return "value must be >= 0"
  if (d.probability !== undefined && (typeof d.probability !== "number" || d.probability < 0 || d.probability > 100)) {
    return "probability must be between 0 and 100"
  }
  return null
}

/** Default win probability per stage (used when not explicitly provided). */
function probabilityForStage(stage: DealStage): number {
  switch (stage) {
    case "lead":
      return 10
    case "qualified":
      return 30
    case "proposal":
      return 50
    case "negotiation":
      return 70
    case "won":
      return 100
    case "lost":
      return 0
  }
}

export async function createDeal(organizationId: string, createdBy: string, input: DealInput): Promise<Deal> {
  const db = createServiceClient()
  const stage = pick(DEAL_STAGES, input.stage, "lead")
  const probability = input.probability ?? probabilityForStage(stage)
  const closed = stage === "won" || stage === "lost"
  const { data, error } = await db
    .from("crm_deals")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      owner_id: input.owner_id ?? createdBy,
      company_id: input.company_id ?? null,
      contact_id: input.contact_id ?? null,
      title: input.title.trim().slice(0, 200),
      description: clampStr(input.description, 5000),
      stage,
      value: clampNum(input.value) ?? 0,
      currency: clampStr(input.currency, 8)?.toUpperCase() ?? "USD",
      probability,
      expected_close_date: input.expected_close_date ?? null,
      closed_at: closed ? new Date().toISOString() : null,
      tags: sanitizeTags(input.tags),
    })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] createDeal failed:", error.message)
    throw new Error("failed to create deal")
  }
  return data as Deal
}

export async function listDeals(
  organizationId: string,
  opts: ListDealsOptions,
): Promise<{ deals: Deal[]; total: number }> {
  const db = createServiceClient()
  let query = db.from("crm_deals").select("*", { count: "exact" }).eq("organization_id", organizationId)

  if (opts.stage) query = query.eq("stage", opts.stage)
  if (opts.companyId) query = query.eq("company_id", opts.companyId)
  if (opts.contactId) query = query.eq("contact_id", opts.contactId)

  query = query
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)

  const { data, error, count } = await query
  if (error) {
    console.log("[v0] listDeals failed:", error.message)
    throw new Error("failed to list deals")
  }
  return { deals: (data ?? []) as Deal[], total: count ?? 0 }
}

export async function getDeal(organizationId: string, id: string): Promise<Deal | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_deals")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()
  if (error) {
    console.log("[v0] getDeal failed:", error.message)
    throw new Error("failed to fetch deal")
  }
  return (data as Deal) ?? null
}

export async function updateDeal(
  organizationId: string,
  id: string,
  input: DealUpdateInput,
): Promise<Deal | null> {
  const db = createServiceClient()
  const patch: Record<string, unknown> = {}
  if (typeof input.title === "string") {
    if (!input.title.trim()) throw new Error("title cannot be empty")
    patch.title = input.title.trim().slice(0, 200)
  }
  if (input.description !== undefined) patch.description = clampStr(input.description, 5000)
  if (input.company_id !== undefined) patch.company_id = input.company_id
  if (input.contact_id !== undefined) patch.contact_id = input.contact_id
  if (input.stage) {
    const stage = pick(DEAL_STAGES, input.stage, "lead")
    patch.stage = stage
    // when moving to a closed stage, stamp closed_at; reopening clears it
    if (stage === "won" || stage === "lost") patch.closed_at = new Date().toISOString()
    else patch.closed_at = null
    // sync probability to stage default unless caller overrides below
    if (input.probability === undefined) patch.probability = probabilityForStage(stage)
  }
  if (input.value !== undefined) {
    const v = clampNum(input.value)
    if (v === null || v < 0) throw new Error("value must be >= 0")
    patch.value = v
  }
  if (input.currency !== undefined) patch.currency = clampStr(input.currency, 8)?.toUpperCase() ?? "USD"
  if (input.probability !== undefined) {
    if (input.probability < 0 || input.probability > 100) throw new Error("probability must be between 0 and 100")
    patch.probability = input.probability
  }
  if (input.expected_close_date !== undefined) patch.expected_close_date = input.expected_close_date
  if (input.tags !== undefined) patch.tags = sanitizeTags(input.tags)
  if (input.owner_id !== undefined) patch.owner_id = input.owner_id
  if (Object.keys(patch).length === 0) return getDeal(organizationId, id)

  const { data, error } = await db
    .from("crm_deals")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .maybeSingle()
  if (error) {
    console.log("[v0] updateDeal failed:", error.message)
    throw new Error("failed to update deal")
  }
  return (data as Deal) ?? null
}

export async function deleteDeal(organizationId: string, id: string): Promise<boolean> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_deals")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error) {
    console.log("[v0] deleteDeal failed:", error.message)
    throw new Error("failed to delete deal")
  }
  return Boolean(data)
}

// ── Pipeline summary ────────────────────────────────────────────────────────--

/**
 * Aggregate open/won deal value by stage for the org. Computed in-process from a
 * scoped select (counts are typically small per tenant); weighted value applies
 * each deal's probability.
 */
export async function getPipelineSummary(organizationId: string): Promise<PipelineSummary> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_deals")
    .select("stage,value,probability,currency")
    .eq("organization_id", organizationId)
  if (error) {
    console.log("[v0] getPipelineSummary failed:", error.message)
    throw new Error("failed to compute pipeline summary")
  }

  const rows = (data ?? []) as Pick<Deal, "stage" | "value" | "probability" | "currency">[]
  const byStage = new Map<DealStage, PipelineStageSummary>()
  for (const stage of DEAL_STAGES) {
    byStage.set(stage, { stage, count: 0, value: 0, weighted_value: 0 })
  }

  let totalOpen = 0
  let weightedOpen = 0
  let wonValue = 0
  let openDeals = 0
  let currency = "USD"

  for (const r of rows) {
    const stage = pick(DEAL_STAGES, r.stage, "lead")
    const value = typeof r.value === "number" ? r.value : 0
    const probability = typeof r.probability === "number" ? r.probability : 0
    if (r.currency) currency = r.currency
    const s = byStage.get(stage)!
    s.count += 1
    s.value += value
    s.weighted_value += (value * probability) / 100
    if (OPEN_STAGES.includes(stage)) {
      totalOpen += value
      weightedOpen += (value * probability) / 100
      openDeals += 1
    } else if (stage === "won") {
      wonValue += value
    }
  }

  return {
    currency,
    total_open_value: Math.round(totalOpen * 100) / 100,
    weighted_open_value: Math.round(weightedOpen * 100) / 100,
    won_value: Math.round(wonValue * 100) / 100,
    open_deals: openDeals,
    stages: DEAL_STAGES.map((st) => byStage.get(st)!),
  }
}

/**
 * Get real-time CRM metrics including WhatsApp integration status, deal velocity,
 * and AI recommendations.
 */
export async function getPipelineSummaryRealtime(organizationId: string): Promise<{
  whatsappConnected: boolean
  dealVelocity: number
  velocityTrend: number[]
  avgLeadScore: number
  leadScoreDistribution: number[]
  aiRecommendations: number
}> {
  const db = createServiceClient()
  
  // Check WhatsApp integration status
  const { data: whatsappData } = await db
    .from("integrations")
    .select("status")
    .eq("organization_id", organizationId)
    .eq("type", "whatsapp")
    .maybeSingle()
  
  const whatsappConnected = whatsappData?.status === "active"
  
  // Calculate deal velocity (deals created per week in last 4 weeks)
  const { data: velocityData } = await db
    .from("crm_deals")
    .select("created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: true })
  
  const velocityTrend = [0, 0, 0, 0]
  if (velocityData && velocityData.length > 0) {
    const now = new Date()
    velocityData.forEach(deal => {
      const dealDate = new Date(deal.created_at)
      const weekIndex = Math.min(3, Math.floor((now.getTime() - dealDate.getTime()) / (7 * 24 * 60 * 60 * 1000)))
      velocityTrend[3 - weekIndex] += 1
    })
  }
  
  const dealVelocity = velocityTrend.reduce((a, b) => a + b, 0) / 4
  
  // Get lead scoring data
  const { data: leadData } = await db
    .from("crm_contacts")
    .select("lead_score")
    .eq("organization_id", organizationId)
    .not("lead_score", "is", null)
    .limit(100)
  
  const leadScores = leadData?.map(c => c.lead_score || 0) || []
  const avgLeadScore = leadScores.length > 0 ? leadScores.reduce((a, b) => a + b, 0) / leadScores.length : 0
  
  // Simple distribution (0-20, 20-40, 40-60, 60-80, 80-100)
  const leadScoreDistribution = [0, 0, 0, 0, 0]
  leadScores.forEach(score => {
    const index = Math.min(4, Math.floor(score / 20))
    leadScoreDistribution[index] += 1
  })
  
  // Normalize distribution
  const maxDist = Math.max(...leadScoreDistribution, 1)
  const normalizedDistribution = leadScoreDistribution.map(v => v / maxDist)
  
  // Get AI recommendations count
  const { data: aiData } = await db
    .from("ai_recommendations")
    .select("id", { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("status", "pending")
  
  const aiRecommendations = aiData?.count || 0
  
  // Get WhatsApp activity (messages per day in last 7 days)
  const { data: whatsappActivityData } = await db
    .from("whatsapp_messages")
    .select("created_at", { count: "exact" })
    .eq("organization_id", organizationId)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  
  const whatsappActivity = whatsappActivityData?.count ? Math.round(whatsappActivityData.count / 7) : 0
  
  return {
    whatsappConnected,
    dealVelocity: Number(dealVelocity.toFixed(1)),
    velocityTrend,
    avgLeadScore: Number(avgLeadScore.toFixed(1)),
    leadScoreDistribution: normalizedDistribution,
    aiRecommendations,
    whatsappActivity,
  }
}

// ── Activities ─────────────────────────────────────────────────────────────────

export function validateActivity(input: unknown): string | null {
  if (!input || typeof input !== "object") return "activity must be an object"
  const a = input as ActivityInput
  if (!a.entity_type || !CRM_ENTITY_TYPES.includes(a.entity_type)) return "invalid entity_type"
  if (!a.entity_id || typeof a.entity_id !== "string") return "entity_id is required"
  if (a.type && !ACTIVITY_TYPES.includes(a.type)) return "invalid activity type"
  if ((!a.subject || !a.subject.trim()) && (!a.body || !a.body.trim())) return "subject or body is required"
  return null
}

/** Verify the target entity exists within the org before logging an activity. */
async function entityExists(organizationId: string, entityType: CrmEntityType, entityId: string): Promise<boolean> {
  const table = entityType === "company" ? "crm_companies" : entityType === "contact" ? "crm_contacts" : "crm_deals"
  const db = createServiceClient()
  const { data, error } = await db
    .from(table)
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", entityId)
    .maybeSingle()
  if (error) {
    console.log("[v0] entityExists failed:", error.message)
    return false
  }
  return Boolean(data)
}

export async function logActivity(
  organizationId: string,
  createdBy: string,
  input: ActivityInput,
): Promise<Activity | null> {
  const exists = await entityExists(organizationId, input.entity_type, input.entity_id)
  if (!exists) return null

  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_activities")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      type: pick(ACTIVITY_TYPES, input.type, "note"),
      subject: (input.subject ?? "").trim().slice(0, 300),
      body: clampStr(input.body, 10000),
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      due_at: input.due_at ?? null,
      completed_at: input.completed_at ?? null,
    })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] logActivity failed:", error.message)
    throw new Error("failed to log activity")
  }
  return data as Activity
}

export async function listActivities(
  organizationId: string,
  opts: ListActivitiesOptions,
): Promise<{ activities: Activity[]; total: number }> {
  const db = createServiceClient()
  let query = db.from("crm_activities").select("*", { count: "exact" }).eq("organization_id", organizationId)

  if (opts.entityType) query = query.eq("entity_type", opts.entityType)
  if (opts.entityId) query = query.eq("entity_id", opts.entityId)
  if (opts.type) query = query.eq("type", opts.type)

  query = query
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)

  const { data, error, count } = await query
  if (error) {
    console.log("[v0] listActivities failed:", error.message)
    throw new Error("failed to list activities")
  }
  return { activities: (data ?? []) as Activity[], total: count ?? 0 }
}
