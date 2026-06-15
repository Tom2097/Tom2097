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
  owner_id?: string | null
}
export type DealUpdateInput = Partial<DealInput>

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
