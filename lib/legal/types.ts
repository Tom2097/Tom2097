/**
 * Module #14: Legal & Compliance — types.
 *
 * Versioned legal documents (terms/privacy/etc.) with a draft/published/archived
 * lifecycle, immutable consent records pinned to a document version, and GDPR
 * data-subject access requests (DSAR) with a status workflow. All records are
 * tenant-scoped by organization_id.
 */

export const LEGAL_DOC_TYPES = [
  "terms",
  "privacy",
  "cookie",
  "dpa",
  "acceptable_use",
  "custom",
] as const
export type LegalDocType = (typeof LEGAL_DOC_TYPES)[number]

export const LEGAL_DOC_STATUSES = ["draft", "published", "archived"] as const
export type LegalDocStatus = (typeof LEGAL_DOC_STATUSES)[number]

export const CONSENT_ACTIONS = ["accepted", "declined", "withdrawn"] as const
export type ConsentAction = (typeof CONSENT_ACTIONS)[number]

export const DSAR_TYPES = [
  "access",
  "erasure",
  "rectification",
  "portability",
  "restriction",
] as const
export type DsarType = (typeof DSAR_TYPES)[number]

export const DSAR_STATUSES = [
  "open",
  "in_progress",
  "awaiting_verification",
  "completed",
  "rejected",
] as const
export type DsarStatus = (typeof DSAR_STATUSES)[number]

// ── Legal documents ───────────────────────────────────────────────────────────

export interface LegalDocument {
  id: string
  organization_id: string
  doc_type: LegalDocType
  title: string
  slug: string
  version: number
  body: string
  summary: string | null
  status: LegalDocStatus
  requires_consent: boolean
  effective_at: string | null
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LegalDocumentInput {
  doc_type: LegalDocType
  title: string
  slug?: string
  body?: string
  summary?: string | null
  requires_consent?: boolean
  effective_at?: string | null
}

export type LegalDocumentUpdateInput = Partial<Omit<LegalDocumentInput, "doc_type">>

export interface ListDocumentsOptions {
  docType?: LegalDocType
  status?: LegalDocStatus
  limit?: number
  offset?: number
}

// ── Consents ──────────────────────────────────────────────────────────────────

export interface LegalConsent {
  id: string
  organization_id: string
  document_id: string
  doc_type: string
  document_version: number
  user_id: string | null
  subject_email: string | null
  action: ConsentAction
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ConsentInput {
  document_id: string
  action?: ConsentAction
  subject_email?: string | null
  metadata?: Record<string, unknown>
}

export interface ListConsentsOptions {
  documentId?: string
  userId?: string
  docType?: LegalDocType
  limit?: number
  offset?: number
}

// ── DSAR requests ───────────────────────────────────────────────────────────

export interface DsarRequest {
  id: string
  organization_id: string
  request_type: DsarType
  status: DsarStatus
  subject_email: string
  subject_user_id: string | null
  details: string | null
  resolution_notes: string | null
  assigned_to: string | null
  due_at: string | null
  completed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DsarInput {
  request_type?: DsarType
  subject_email: string
  details?: string | null
  assigned_to?: string | null
  due_at?: string | null
}

export interface DsarUpdateInput {
  status?: DsarStatus
  request_type?: DsarType
  details?: string | null
  resolution_notes?: string | null
  assigned_to?: string | null
  due_at?: string | null
}

export interface ListDsarOptions {
  status?: DsarStatus
  requestType?: DsarType
  limit?: number
  offset?: number
}
