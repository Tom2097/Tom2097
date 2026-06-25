import { createServiceClient } from "@/lib/supabase/service"
import type {
  Quote, QuoteInput, QuoteUpdateInput, QuoteStatus,
  TimelineEntry, TimelineEntryInput,
  CrmTask, CrmTaskInput, CrmTaskUpdateInput, TaskStatus, TaskPriority,
  Communication, CommunicationInput, CommunicationChannel,
  CommTemplate, CommTemplateInput,
  CustomerAccount, CustomerAccountUpdateInput, AccountHealthStatus,
  LeadScore, LeadScoreFactor,
  ListQuotesOptions, ListTimelineOptions, ListTasksOptions,
  ListCommunicationsOptions, ListCustomerAccountsOptions, ListTemplatesOptions,
  CrmEntityType, DealStage,
} from "./types"

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : v
  return typeof n === "number" && Number.isFinite(n) ? n : 0
}

// ── Quotes & Proposals ──────────────────────────────────────────────────────

export async function createQuote(organizationId: string, createdBy: string, input: QuoteInput): Promise<Quote> {
  const db = createServiceClient()
  const total = input.line_items?.reduce((s, i) => s + i.total, 0) ?? input.value ?? 0
  const { data, error } = await db
    .from("crm_quotes")
    .insert({
      organization_id: organizationId,
      deal_id: input.deal_id ?? null,
      contact_id: input.contact_id ?? null,
      company_id: input.company_id ?? null,
      title: input.title.trim(),
      status: "draft",
      value: total,
      currency: input.currency ?? "USD",
      line_items: input.line_items ?? [],
      notes: input.notes ?? null,
      valid_until: input.valid_until ?? null,
      created_by: createdBy,
    })
    .select("*")
    .single()
  if (error) { console.log("[v0] createQuote failed:", error.message); throw new Error("failed to create quote") }
  return data as Quote
}

export async function listQuotes(organizationId: string, opts: ListQuotesOptions = {}): Promise<{ quotes: Quote[]; total: number }> {
  const db = createServiceClient()
  let q = db.from("crm_quotes").select("*", { count: "exact" }).eq("organization_id", organizationId)
  if (opts.status) q = q.eq("status", opts.status)
  if (opts.dealId) q = q.eq("deal_id", opts.dealId)
  q = q.order("created_at", { ascending: false }).range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)
  const { data, error, count } = await q
  if (error) { console.log("[v0] listQuotes failed:", error.message); throw new Error("failed to list quotes") }
  return { quotes: (data ?? []) as Quote[], total: count ?? 0 }
}

export async function updateQuoteStatus(organizationId: string, id: string, status: QuoteStatus): Promise<Quote | null> {
  const db = createServiceClient()
  const patch: Record<string, unknown> = { status }
  if (status === "sent") patch.sent_at = new Date().toISOString()
  if (status === "accepted") patch.accepted_at = new Date().toISOString()
  const { data, error } = await db.from("crm_quotes").update(patch).eq("id", id).eq("organization_id", organizationId).select("*").maybeSingle()
  if (error) { console.log("[v0] updateQuoteStatus failed:", error.message); throw new Error("failed to update quote") }
  return (data as Quote) ?? null
}

// ── Engagement Timeline ─────────────────────────────────────────────────────

export async function addTimelineEntry(organizationId: string, createdBy: string, input: TimelineEntryInput): Promise<TimelineEntry> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_timeline")
    .insert({
      organization_id: organizationId,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      entry_type: input.entry_type,
      title: input.title.trim(),
      description: input.description ?? null,
      metadata: input.metadata ?? null,
      occurred_at: input.occurred_at ?? new Date().toISOString(),
      created_by: createdBy,
    })
    .select("*")
    .single()
  if (error) { console.log("[v0] addTimelineEntry failed:", error.message); throw new Error("failed to add timeline entry") }
  return data as TimelineEntry
}

export async function listTimeline(organizationId: string, opts: ListTimelineOptions = {}): Promise<{ entries: TimelineEntry[]; total: number }> {
  const db = createServiceClient()
  let q = db.from("crm_timeline").select("*", { count: "exact" }).eq("organization_id", organizationId)
  if (opts.entityType) q = q.eq("entity_type", opts.entityType)
  if (opts.entityId) q = q.eq("entity_id", opts.entityId)
  if (opts.entryType) q = q.eq("entry_type", opts.entryType)
  q = q.order("occurred_at", { ascending: false }).range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)
  const { data, error, count } = await q
  if (error) { console.log("[v0] listTimeline failed:", error.message); throw new Error("failed to list timeline") }
  return { entries: (data ?? []) as TimelineEntry[], total: count ?? 0 }
}

// ── CRM Tasks / Cadences ────────────────────────────────────────────────────

export async function createTask(organizationId: string, createdBy: string, input: CrmTaskInput): Promise<CrmTask> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_tasks")
    .insert({
      organization_id: organizationId,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      title: input.title.trim(),
      description: input.description ?? null,
      priority: input.priority ?? "medium",
      status: "pending",
      due_at: input.due_at ?? null,
      assigned_to: input.assigned_to ?? null,
      created_by: createdBy,
    })
    .select("*")
    .single()
  if (error) { console.log("[v0] createTask failed:", error.message); throw new Error("failed to create task") }
  return data as CrmTask
}

export async function listTasks(organizationId: string, opts: ListTasksOptions = {}): Promise<{ tasks: CrmTask[]; total: number }> {
  const db = createServiceClient()
  let q = db.from("crm_tasks").select("*", { count: "exact" }).eq("organization_id", organizationId)
  if (opts.status) q = q.eq("status", opts.status)
  if (opts.priority) q = q.eq("priority", opts.priority)
  if (opts.assignedTo) q = q.eq("assigned_to", opts.assignedTo)
  if (opts.entityType) q = q.eq("entity_type", opts.entityType)
  if (opts.entityId) q = q.eq("entity_id", opts.entityId)
  q = q.order("created_at", { ascending: false }).range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)
  const { data, error, count } = await q
  if (error) { console.log("[v0] listTasks failed:", error.message); throw new Error("failed to list tasks") }
  return { tasks: (data ?? []) as CrmTask[], total: count ?? 0 }
}

export async function updateTask(organizationId: string, id: string, input: CrmTaskUpdateInput): Promise<CrmTask | null> {
  const db = createServiceClient()
  const patch: Record<string, unknown> = { ...input }
  if (input.status === "completed") patch.completed_at = new Date().toISOString()
  const { data, error } = await db.from("crm_tasks").update(patch).eq("id", id).eq("organization_id", organizationId).select("*").maybeSingle()
  if (error) { console.log("[v0] updateTask failed:", error.message); throw new Error("failed to update task") }
  return (data as CrmTask) ?? null
}

export async function deleteTask(organizationId: string, id: string): Promise<boolean> {
  const db = createServiceClient()
  const { error } = await db.from("crm_tasks").delete().eq("id", id).eq("organization_id", organizationId)
  if (error) { console.log("[v0] deleteTask failed:", error.message); return false }
  return true
}

// ── Communication Hub ──────────────────────────────────────────────────────

export async function sendCommunication(organizationId: string, userId: string, input: CommunicationInput): Promise<Communication> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_communications")
    .insert({
      organization_id: organizationId,
      channel: input.channel,
      direction: input.direction,
      subject: input.subject.trim(),
      body: input.body,
      from_address: input.from_address,
      to_address: input.to_address,
      contact_id: input.contact_id ?? null,
      deal_id: input.deal_id ?? null,
      template_id: input.template_id ?? null,
      status: "sent",
      sent_at: new Date().toISOString(),
      created_by: userId,
    })
    .select("*")
    .single()
  if (error) { console.log("[v0] sendCommunication failed:", error.message); throw new Error("failed to send communication") }
  return data as Communication
}

export async function listCommunications(organizationId: string, opts: ListCommunicationsOptions = {}): Promise<{ communications: Communication[]; total: number }> {
  const db = createServiceClient()
  let q = db.from("crm_communications").select("*", { count: "exact" }).eq("organization_id", organizationId)
  if (opts.channel) q = q.eq("channel", opts.channel)
  if (opts.contactId) q = q.eq("contact_id", opts.contactId)
  if (opts.dealId) q = q.eq("deal_id", opts.dealId)
  q = q.order("sent_at", { ascending: false }).range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)
  const { data, error, count } = await q
  if (error) { console.log("[v0] listCommunications failed:", error.message); throw new Error("failed to list communications") }
  return { communications: (data ?? []) as Communication[], total: count ?? 0 }
}

// ── Communication Templates ────────────────────────────────────────────────

export async function createTemplate(organizationId: string, input: CommTemplateInput): Promise<CommTemplate> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("crm_templates")
    .insert({
      organization_id: organizationId,
      name: input.name.trim(),
      channel: input.channel,
      subject: input.subject.trim(),
      body: input.body,
      variables: input.variables ?? [],
      category: input.category ?? null,
    })
    .select("*")
    .single()
  if (error) { console.log("[v0] createTemplate failed:", error.message); throw new Error("failed to create template") }
  return data as CommTemplate
}

export async function listTemplates(organizationId: string, opts: ListTemplatesOptions = {}): Promise<{ templates: CommTemplate[]; total: number }> {
  const db = createServiceClient()
  let q = db.from("crm_templates").select("*", { count: "exact" }).eq("organization_id", organizationId)
  if (opts.channel) q = q.eq("channel", opts.channel)
  if (opts.category) q = q.eq("category", opts.category)
  q = q.order("name").range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)
  const { data, error, count } = await q
  if (error) { console.log("[v0] listTemplates failed:", error.message); throw new Error("failed to list templates") }
  return { templates: (data ?? []) as CommTemplate[], total: count ?? 0 }
}

// ── Customer Success ───────────────────────────────────────────────────────

export async function getCustomerAccount(organizationId: string, companyId: string): Promise<CustomerAccount | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("customer_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .maybeSingle()
  if (error) { console.log("[v0] getCustomerAccount failed:", error.message); return null }
  return (data as CustomerAccount) ?? null
}

export async function listCustomerAccounts(organizationId: string, opts: ListCustomerAccountsOptions = {}): Promise<{ accounts: CustomerAccount[]; total: number }> {
  const db = createServiceClient()
  let q = db.from("customer_accounts").select("*", { count: "exact" }).eq("organization_id", organizationId)
  if (opts.healthStatus) q = q.eq("health_status", opts.healthStatus)
  if (opts.companyId) q = q.eq("company_id", opts.companyId)
  q = q.order("created_at", { ascending: false }).range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1)
  const { data, error, count } = await q
  if (error) { console.log("[v0] listCustomerAccounts failed:", error.message); throw new Error("failed to list customer accounts") }
  return { accounts: (data ?? []) as CustomerAccount[], total: count ?? 0 }
}

export async function updateCustomerAccount(organizationId: string, id: string, input: CustomerAccountUpdateInput): Promise<CustomerAccount | null> {
  const db = createServiceClient()
  const { data, error } = await db.from("customer_accounts").update(input).eq("id", id).eq("organization_id", organizationId).select("*").maybeSingle()
  if (error) { console.log("[v0] updateCustomerAccount failed:", error.message); throw new Error("failed to update customer account") }
  return (data as CustomerAccount) ?? null
}

// ── AI Lead Scoring ───────────────────────────────────────────────────────

export function computeLeadScore(contact: { email?: string | null; title?: string | null; company_id?: string | null; tags?: string[]; created_at?: string }): LeadScore {
  const factors: LeadScoreFactor[] = []
  let score = 50

  if (contact.email && contact.email.endsWith(".com")) {
    factors.push({ name: "email_valid", weight: 10, value: 10, description: "Valid email domain" })
    score += 10
  }

  if (contact.title) {
    const seniority = ["vp", "director", "head", "chief", "owner", "founder", "ceo", "cto", "cfo"]
    const isSenior = seniority.some((s) => contact.title!.toLowerCase().includes(s))
    if (isSenior) {
      factors.push({ name: "senior_title", weight: 15, value: 15, description: "Senior/decision-maker title" })
      score += 15
    } else {
      factors.push({ name: "has_title", weight: 5, value: 5, description: "Title provided" })
      score += 5
    }
  }

  if (contact.company_id) {
    factors.push({ name: "has_company", weight: 10, value: 10, description: "Associated with a company" })
    score += 10
  }

  if (contact.tags && contact.tags.length > 0) {
    factors.push({ name: "has_tags", weight: 5, value: 5, description: "Has tags/segmentation" })
    score += 5
  }

  const ageDays = contact.created_at
    ? (Date.now() - new Date(contact.created_at).getTime()) / (1000 * 60 * 60 * 24)
    : 30
  if (ageDays < 7) {
    factors.push({ name: "recent", weight: 10, value: 10, description: "Added within the last 7 days" })
    score += 10
  }

  const finalScore = Math.max(0, Math.min(100, score))
  return { contact_id: "", score: finalScore, factors, last_updated: new Date().toISOString() }
}

export function enrichContactFromEmail(email: string): { company_name?: string; domain?: string; industry?: string; company_size?: string } {
  const domain = email.split("@")[1]
  if (!domain) return {}
  const companyName = domain.split(".")[0]
  return {
    company_name: companyName.charAt(0).toUpperCase() + companyName.slice(1),
    domain,
  }
}
