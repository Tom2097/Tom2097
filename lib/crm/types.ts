/**
 * Module #17: Customer CRM — shared types.
 *
 * Companies (accounts), contacts (people), deals (pipeline), and activities
 * (notes/calls/tasks). The engine uses the service-role client and scopes every
 * query to the `organizationId` resolved by withAuth, preserving the
 * multi-tenant boundary (cross-tenant ids no-op rather than leak).
 */

export const CONTACT_STATUSES = ["lead", "active", "inactive", "archived"] as const
export type ContactStatus = (typeof CONTACT_STATUSES)[number]

export const DEAL_STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const
export type DealStage = (typeof DEAL_STAGES)[number]

export const ACTIVITY_TYPES = ["note", "call", "email", "meeting", "task"] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export const CRM_ENTITY_TYPES = ["company", "contact", "deal"] as const
export type CrmEntityType = (typeof CRM_ENTITY_TYPES)[number]

// ── Companies ─────────────────────────────────────────────────────────────────

export interface Company {
  id: string
  organization_id: string
  name: string
  domain: string | null
  industry: string | null
  website: string | null
  phone: string | null
  size: string | null
  annual_revenue: number | null
  notes: string | null
  tags: string[]
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CompanyInput {
  name: string
  domain?: string | null
  industry?: string | null
  website?: string | null
  phone?: string | null
  size?: string | null
  annual_revenue?: number | null
  notes?: string | null
  tags?: string[]
  owner_id?: string | null
}
export type CompanyUpdateInput = Partial<CompanyInput>

// ── Contacts ──────────────────────────────────────────────────────────────────

export interface Contact {
  id: string
  organization_id: string
  company_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  title: string | null
  status: ContactStatus
  notes: string | null
  tags: string[]
  source: string | null
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ContactInput {
  company_id?: string | null
  first_name?: string
  last_name?: string
  email?: string | null
  phone?: string | null
  title?: string | null
  status?: ContactStatus
  notes?: string | null
  tags?: string[]
  source?: string | null
  owner_id?: string | null
}
export type ContactUpdateInput = Partial<ContactInput>

// ── Deals ───────────────────────────────────────────────────────────────────--

export interface Deal {
  id: string
  organization_id: string
  company_id: string | null
  contact_id: string | null
  title: string
  description: string | null
  stage: DealStage
  value: number
  currency: string
  probability: number
  expected_close_date: string | null
  closed_at: string | null
  tags: string[]
  source: string | null
  lost_reason: string | null
  owner_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DealInput {
  company_id?: string | null
  contact_id?: string | null
  title: string
  description?: string | null
  stage?: DealStage
  value?: number
  currency?: string
  probability?: number
  expected_close_date?: string | null
  tags?: string[]
  source?: string | null
  owner_id?: string | null
}
export type DealUpdateInput = Partial<DealInput> & { lost_reason?: string | null }

// ── Activities ─────────────────────────────────────────────────────────────────

export interface Activity {
  id: string
  organization_id: string
  type: ActivityType
  subject: string
  body: string | null
  entity_type: CrmEntityType
  entity_id: string
  due_at: string | null
  completed_at: string | null
  created_by: string | null
  created_at: string
}

export interface ActivityInput {
  type?: ActivityType
  subject?: string
  body?: string | null
  entity_type: CrmEntityType
  entity_id: string
  due_at?: string | null
  completed_at?: string | null
}

// ── List options ────────────────────────────────────────────────────────────--

export interface ListCompaniesOptions {
  limit?: number
  offset?: number
  search?: string
}

export interface ListContactsOptions {
  limit?: number
  offset?: number
  search?: string
  status?: ContactStatus
  companyId?: string
}

export interface ListDealsOptions {
  limit?: number
  offset?: number
  stage?: DealStage
  companyId?: string
  contactId?: string
}

export interface ListActivitiesOptions {
  limit?: number
  offset?: number
  entityType?: CrmEntityType
  entityId?: string
  type?: ActivityType
}

// ── Pipeline summary ────────────────────────────────────────────────────────--

export interface PipelineStageSummary {
  stage: DealStage
  count: number
  value: number
  weighted_value: number
}

export interface PipelineSummary {
  currency: string
  total_open_value: number
  weighted_open_value: number
  won_value: number
  open_deals: number
  stages: PipelineStageSummary[]
}

// ── Quotes & Proposals ───────────────────────────────────────────────────────

export const QUOTE_STATUSES = ["draft", "sent", "viewed", "accepted", "rejected", "expired"] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export interface Quote {
  id: string
  organization_id: string
  deal_id: string | null
  contact_id: string | null
  company_id: string | null
  title: string
  status: QuoteStatus
  value: number
  currency: string
  line_items: QuoteLineItem[]
  notes: string | null
  valid_until: string | null
  sent_at: string | null
  accepted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface QuoteLineItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

export interface QuoteInput {
  deal_id?: string | null
  contact_id?: string | null
  company_id?: string | null
  title: string
  value?: number
  currency?: string
  line_items?: QuoteLineItem[]
  notes?: string | null
  valid_until?: string | null
}

export type QuoteUpdateInput = Partial<QuoteInput & { status?: QuoteStatus }>

// ── Engagement Timeline ───────────────────────────────────────────────────────

export const TIMELINE_ENTRY_TYPES = [
  "note", "call", "email", "meeting", "task_completed",
  "deal_stage_change", "quote_sent", "quote_accepted",
  "email_opened", "link_clicked", "form_submitted", "whatsapp",
] as const
export type TimelineEntryType = (typeof TIMELINE_ENTRY_TYPES)[number]

export interface TimelineEntry {
  id: string
  organization_id: string
  entity_type: CrmEntityType
  entity_id: string
  entry_type: TimelineEntryType
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
  occurred_at: string
  created_by: string | null
  created_at: string
}

export interface TimelineEntryInput {
  entity_type: CrmEntityType
  entity_id: string
  entry_type: TimelineEntryType
  title: string
  description?: string | null
  metadata?: Record<string, unknown> | null
  occurred_at?: string
}

// ── CRM Tasks / Cadences ──────────────────────────────────────────────────────

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export interface CrmTask {
  id: string
  organization_id: string
  entity_type: CrmEntityType | null
  entity_id: string | null
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  due_at: string | null
  completed_at: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CrmTaskInput {
  entity_type?: CrmEntityType | null
  entity_id?: string | null
  title: string
  description?: string | null
  priority?: TaskPriority
  due_at?: string | null
  assigned_to?: string | null
}

export type CrmTaskUpdateInput = Partial<CrmTaskInput & { status?: TaskStatus }>

// ── Communication Hub ─────────────────────────────────────────────────────────

export const COMMUNICATION_CHANNELS = ["email", "whatsapp", "sms"] as const
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number]

export const COMMUNICATION_DIRECTIONS = ["outbound", "inbound"] as const
export type CommunicationDirection = (typeof COMMUNICATION_DIRECTIONS)[number]

export interface Communication {
  id: string
  organization_id: string
  channel: CommunicationChannel
  direction: CommunicationDirection
  subject: string
  body: string
  from_address: string
  to_address: string
  contact_id: string | null
  deal_id: string | null
  status: "sent" | "delivered" | "read" | "failed"
  template_id: string | null
  sent_at: string
  read_at: string | null
  created_by: string | null
}

export interface CommunicationInput {
  channel: CommunicationChannel
  direction: CommunicationDirection
  subject: string
  body: string
  from_address: string
  to_address: string
  contact_id?: string | null
  deal_id?: string | null
  template_id?: string | null
}

// ── Communication Templates ───────────────────────────────────────────────────

export interface CommTemplate {
  id: string
  organization_id: string
  name: string
  channel: CommunicationChannel
  subject: string
  body: string
  variables: string[]
  category: string | null
  created_at: string
  updated_at: string
}

export interface CommTemplateInput {
  name: string
  channel: CommunicationChannel
  subject: string
  body: string
  variables?: string[]
  category?: string | null
}

// ── Customer Success ──────────────────────────────────────────────────────────

export const ACCOUNT_HEALTH_STATUSES = ["healthy", "at_risk", "churned"] as const
export type AccountHealthStatus = (typeof ACCOUNT_HEALTH_STATUSES)[number]

export interface CustomerAccount {
  id: string
  organization_id: string
  company_id: string
  health_status: AccountHealthStatus
  health_score: number
  health_score_breakdown: Record<string, number> | null
  onboarding_completed: boolean
  onboarding_step: string | null
  renewal_date: string | null
  upsell_potential: "low" | "medium" | "high" | null
  last_activity_at: string | null
  created_at: string
  updated_at: string
}

export interface CustomerAccountUpdateInput {
  health_status?: AccountHealthStatus
  health_score?: number
  health_score_breakdown?: Record<string, number> | null
  onboarding_completed?: boolean
  onboarding_step?: string | null
  renewal_date?: string | null
  upsell_potential?: "low" | "medium" | "high" | null
  last_activity_at?: string | null
}

// ── Lead Scoring ──────────────────────────────────────────────────────────────

export interface LeadScore {
  contact_id: string
  score: number
  factors: LeadScoreFactor[]
  last_updated: string
}

export interface LeadScoreFactor {
  name: string
  weight: number
  value: number
  description: string
}

// ── List options for new entities ─────────────────────────────────────────────

export interface ListQuotesOptions {
  limit?: number
  offset?: number
  status?: QuoteStatus
  dealId?: string
}

export interface ListTimelineOptions {
  limit?: number
  offset?: number
  entityType?: CrmEntityType
  entityId?: string
  entryType?: TimelineEntryType
}

export interface ListTasksOptions {
  limit?: number
  offset?: number
  status?: TaskStatus
  priority?: TaskPriority
  assignedTo?: string
  entityType?: CrmEntityType
  entityId?: string
}

export interface ListCommunicationsOptions {
  limit?: number
  offset?: number
  channel?: CommunicationChannel
  contactId?: string
  dealId?: string
}

export interface ListCustomerAccountsOptions {
  limit?: number
  offset?: number
  healthStatus?: AccountHealthStatus
  companyId?: string
}

export interface ListTemplatesOptions {
  limit?: number
  offset?: number
  channel?: CommunicationChannel
  category?: string
}
