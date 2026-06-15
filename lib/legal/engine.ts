import { createServiceClient } from "@/lib/supabase/service"
import {
  CONSENT_ACTIONS,
  DSAR_STATUSES,
  DSAR_TYPES,
  LEGAL_DOC_TYPES,
  type ConsentAction,
  type ConsentInput,
  type DsarInput,
  type DsarRequest,
  type DsarType,
  type DsarUpdateInput,
  type LegalConsent,
  type LegalDocType,
  type LegalDocument,
  type LegalDocumentInput,
  type LegalDocumentUpdateInput,
  type ListConsentsOptions,
  type ListDocumentsOptions,
  type ListDsarOptions,
} from "./types"

/**
 * Module #14: Legal & Compliance engine.
 *
 * Writes go through the service client (RLS-exempt) but EVERY function takes an
 * already-validated `organizationId` (resolved by withAuth) and scopes all I/O
 * to it, preserving the multi-tenant boundary established in Module #1.
 *
 * Design notes:
 *  - Legal documents are versioned. Publishing a new version archives the
 *    previously-published version of the same doc_type, enforced together with
 *    the partial unique index idx_legal_docs_one_published.
 *  - Consents are immutable acceptance records pinned to a specific document
 *    version, so historical proof survives later edits.
 *  - DSAR requests follow a status workflow with an SLA due date.
 */

const MAX_BODY = 500_000
const MAX_TITLE = 300
const DEFAULT_DSAR_SLA_DAYS = 30

function pick<T extends readonly string[]>(allowed: T, v: unknown, fallback: T[number]): T[number] {
  return allowed.includes(v as T[number]) ? (v as T[number]) : fallback
}

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, max)
}

function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
}

// ── Legal documents ───────────────────────────────────────────────────────────

export function validateDocument(input: unknown): string | null {
  if (!input || typeof input !== "object") return "document must be an object"
  const d = input as LegalDocumentInput
  if (!d.doc_type || !LEGAL_DOC_TYPES.includes(d.doc_type)) {
    return `doc_type must be one of: ${LEGAL_DOC_TYPES.join(", ")}`
  }
  if (!d.title || typeof d.title !== "string" || !d.title.trim()) return "title is required"
  if (d.title.length > MAX_TITLE) return `title too long (max ${MAX_TITLE})`
  if (typeof d.body === "string" && d.body.length > MAX_BODY) return `body too long (max ${MAX_BODY})`
  return null
}

/**
 * Resolve the next version number for a (org, doc_type). Versions increment
 * across the whole doc_type so every draft/published revision is uniquely
 * numbered and consent records can pin to an exact version.
 */
async function nextVersion(organizationId: string, docType: LegalDocType): Promise<number> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("legal_documents")
    .select("version")
    .eq("organization_id", organizationId)
    .eq("doc_type", docType)
    .order("version", { ascending: false })
    .limit(1)
  if (error) {
    console.log("[v0] nextVersion failed:", error.message)
    throw new Error("failed to resolve version")
  }
  const top = data && data.length > 0 ? Number(data[0].version) : 0
  return (Number.isFinite(top) ? top : 0) + 1
}

export async function createDocument(
  organizationId: string,
  createdBy: string,
  input: LegalDocumentInput,
): Promise<LegalDocument> {
  const db = createServiceClient()
  const version = await nextVersion(organizationId, input.doc_type)
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(input.title)

  const { data, error } = await db
    .from("legal_documents")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      doc_type: input.doc_type,
      title: input.title.trim().slice(0, MAX_TITLE),
      slug: slug || input.doc_type,
      version,
      body: typeof input.body === "string" ? input.body.slice(0, MAX_BODY) : "",
      summary: clampStr(input.summary, 2000),
      status: "draft",
      requires_consent: input.requires_consent !== false,
      effective_at: input.effective_at ?? null,
    })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] createDocument failed:", error.message)
    throw new Error("failed to create document")
  }
  return data as LegalDocument
}

export async function getDocument(organizationId: string, id: string): Promise<LegalDocument | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("legal_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()
  if (error) {
    console.log("[v0] getDocument failed:", error.message)
    throw new Error("failed to fetch document")
  }
  return (data as LegalDocument) ?? null
}

export async function listDocuments(
  organizationId: string,
  opts: ListDocumentsOptions = {},
): Promise<{ documents: LegalDocument[]; total: number }> {
  const db = createServiceClient()
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100)
  const offset = Math.max(opts.offset ?? 0, 0)

  let q = db
    .from("legal_documents")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("doc_type", { ascending: true })
    .order("version", { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.docType) q = q.eq("doc_type", opts.docType)
  if (opts.status) q = q.eq("status", opts.status)

  const { data, error, count } = await q
  if (error) {
    console.log("[v0] listDocuments failed:", error.message)
    throw new Error("failed to list documents")
  }
  return { documents: (data as LegalDocument[]) ?? [], total: count ?? 0 }
}

/**
 * Return the currently published document for a given type (or null). This is
 * what client apps surface to end users for consent capture.
 */
export async function getPublishedDocument(
  organizationId: string,
  docType: LegalDocType,
): Promise<LegalDocument | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("legal_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("doc_type", docType)
    .eq("status", "published")
    .maybeSingle()
  if (error) {
    console.log("[v0] getPublishedDocument failed:", error.message)
    throw new Error("failed to fetch published document")
  }
  return (data as LegalDocument) ?? null
}

export async function updateDocument(
  organizationId: string,
  id: string,
  input: LegalDocumentUpdateInput,
): Promise<LegalDocument | null> {
  const db = createServiceClient()
  const existing = await getDocument(organizationId, id)
  if (!existing) return null
  // Only drafts are editable; published/archived versions are immutable so that
  // consent records always reference stable content.
  if (existing.status !== "draft") {
    throw new Error("only draft documents can be edited; create a new version instead")
  }

  const patch: Record<string, unknown> = {}
  if (typeof input.title === "string" && input.title.trim()) patch.title = input.title.trim().slice(0, MAX_TITLE)
  if (typeof input.slug === "string" && input.slug.trim()) patch.slug = slugify(input.slug)
  if (typeof input.body === "string") patch.body = input.body.slice(0, MAX_BODY)
  if ("summary" in input) patch.summary = clampStr(input.summary, 2000)
  if (typeof input.requires_consent === "boolean") patch.requires_consent = input.requires_consent
  if ("effective_at" in input) patch.effective_at = input.effective_at ?? null

  if (Object.keys(patch).length === 0) return existing

  const { data, error } = await db
    .from("legal_documents")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .single()
  if (error) {
    console.log("[v0] updateDocument failed:", error.message)
    throw new Error("failed to update document")
  }
  return data as LegalDocument
}

/**
 * Publish a draft document. Archives any currently-published version of the same
 * doc_type first, guaranteeing a single live version (also guarded by the
 * partial unique index).
 */
export async function publishDocument(
  organizationId: string,
  id: string,
): Promise<LegalDocument | null> {
  const db = createServiceClient()
  const doc = await getDocument(organizationId, id)
  if (!doc) return null
  if (doc.status === "published") return doc
  if (doc.status === "archived") throw new Error("cannot publish an archived document")

  // Archive the existing published version of this doc_type, if any.
  const { error: archiveErr } = await db
    .from("legal_documents")
    .update({ status: "archived" })
    .eq("organization_id", organizationId)
    .eq("doc_type", doc.doc_type)
    .eq("status", "published")
  if (archiveErr) {
    console.log("[v0] publishDocument archive-prev failed:", archiveErr.message)
    throw new Error("failed to archive previous version")
  }

  const { data, error } = await db
    .from("legal_documents")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      effective_at: doc.effective_at ?? new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .single()
  if (error) {
    console.log("[v0] publishDocument failed:", error.message)
    throw new Error("failed to publish document")
  }
  return data as LegalDocument
}

export async function archiveDocument(
  organizationId: string,
  id: string,
): Promise<LegalDocument | null> {
  const db = createServiceClient()
  const doc = await getDocument(organizationId, id)
  if (!doc) return null
  const { data, error } = await db
    .from("legal_documents")
    .update({ status: "archived" })
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .single()
  if (error) {
    console.log("[v0] archiveDocument failed:", error.message)
    throw new Error("failed to archive document")
  }
  return data as LegalDocument
}

export async function deleteDocument(organizationId: string, id: string): Promise<boolean> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("legal_documents")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error) {
    console.log("[v0] deleteDocument failed:", error.message)
    throw new Error("failed to delete document")
  }
  return !!data
}

// ── Consents ──────────────────────────────────────────────────────────────────

/**
 * Record an immutable consent decision. The consent is pinned to the document's
 * current doc_type + version so later edits never rewrite history. Identifies
 * the subject by the authenticated user and/or an explicit subject email.
 */
export async function recordConsent(
  organizationId: string,
  input: ConsentInput,
  ctx: { userId?: string | null; ipAddress?: string | null; userAgent?: string | null },
): Promise<LegalConsent> {
  const db = createServiceClient()
  if (!input || typeof input !== "object" || !input.document_id) {
    throw new Error("document_id is required")
  }
  const doc = await getDocument(organizationId, input.document_id)
  if (!doc) throw new Error("document not found")

  const action: ConsentAction = pick(CONSENT_ACTIONS, input.action, "accepted")

  const { data, error } = await db
    .from("legal_consents")
    .insert({
      organization_id: organizationId,
      document_id: doc.id,
      doc_type: doc.doc_type,
      document_version: doc.version,
      user_id: ctx.userId ?? null,
      subject_email: clampStr(input.subject_email, 320),
      action,
      ip_address: ctx.ipAddress ?? null,
      user_agent: ctx.userAgent ? ctx.userAgent.slice(0, 1000) : null,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] recordConsent failed:", error.message)
    throw new Error("failed to record consent")
  }
  return data as LegalConsent
}

export async function listConsents(
  organizationId: string,
  opts: ListConsentsOptions = {},
): Promise<{ consents: LegalConsent[]; total: number }> {
  const db = createServiceClient()
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const offset = Math.max(opts.offset ?? 0, 0)

  let q = db
    .from("legal_consents")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.documentId) q = q.eq("document_id", opts.documentId)
  if (opts.userId) q = q.eq("user_id", opts.userId)
  if (opts.docType) q = q.eq("doc_type", opts.docType)

  const { data, error, count } = await q
  if (error) {
    console.log("[v0] listConsents failed:", error.message)
    throw new Error("failed to list consents")
  }
  return { consents: (data as LegalConsent[]) ?? [], total: count ?? 0 }
}

// ── DSAR requests ───────────────────────────────────────────────────────────

export function validateDsar(input: unknown): string | null {
  if (!input || typeof input !== "object") return "request must be an object"
  const d = input as DsarInput
  if (!isEmail(d.subject_email)) return "a valid subject_email is required"
  if (d.request_type && !DSAR_TYPES.includes(d.request_type)) {
    return `request_type must be one of: ${DSAR_TYPES.join(", ")}`
  }
  return null
}

export async function createDsar(
  organizationId: string,
  createdBy: string,
  input: DsarInput,
): Promise<DsarRequest> {
  const db = createServiceClient()
  const requestType: DsarType = pick(DSAR_TYPES, input.request_type, "access")
  const due =
    input.due_at ??
    new Date(Date.now() + DEFAULT_DSAR_SLA_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from("dsar_requests")
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      request_type: requestType,
      status: "open",
      subject_email: input.subject_email.trim().slice(0, 320),
      details: clampStr(input.details, 5000),
      assigned_to: input.assigned_to ?? null,
      due_at: due,
    })
    .select("*")
    .single()
  if (error) {
    console.log("[v0] createDsar failed:", error.message)
    throw new Error("failed to create DSAR request")
  }
  return data as DsarRequest
}

export async function getDsar(organizationId: string, id: string): Promise<DsarRequest | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("dsar_requests")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()
  if (error) {
    console.log("[v0] getDsar failed:", error.message)
    throw new Error("failed to fetch DSAR request")
  }
  return (data as DsarRequest) ?? null
}

export async function listDsar(
  organizationId: string,
  opts: ListDsarOptions = {},
): Promise<{ requests: DsarRequest[]; total: number }> {
  const db = createServiceClient()
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100)
  const offset = Math.max(opts.offset ?? 0, 0)

  let q = db
    .from("dsar_requests")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.status) q = q.eq("status", opts.status)
  if (opts.requestType) q = q.eq("request_type", opts.requestType)

  const { data, error, count } = await q
  if (error) {
    console.log("[v0] listDsar failed:", error.message)
    throw new Error("failed to list DSAR requests")
  }
  return { requests: (data as DsarRequest[]) ?? [], total: count ?? 0 }
}

/**
 * Update a DSAR request. Returns the updated row plus a `statusChange` marker
 * ("completed" | "rejected" | null) so the route can emit the right audit event
 * and stamp completed_at on terminal transitions.
 */
export async function updateDsar(
  organizationId: string,
  id: string,
  input: DsarUpdateInput,
): Promise<{ request: DsarRequest; statusChange: "completed" | "rejected" | null } | null> {
  const db = createServiceClient()
  const existing = await getDsar(organizationId, id)
  if (!existing) return null

  const patch: Record<string, unknown> = {}
  let statusChange: "completed" | "rejected" | null = null

  if (input.status && DSAR_STATUSES.includes(input.status)) {
    patch.status = input.status
    if (input.status === "completed" && existing.status !== "completed") {
      patch.completed_at = new Date().toISOString()
      statusChange = "completed"
    } else if (input.status === "rejected" && existing.status !== "rejected") {
      patch.completed_at = new Date().toISOString()
      statusChange = "rejected"
    } else if (input.status !== "completed" && input.status !== "rejected") {
      patch.completed_at = null
    }
  }
  if (input.request_type && DSAR_TYPES.includes(input.request_type)) patch.request_type = input.request_type
  if ("details" in input) patch.details = clampStr(input.details, 5000)
  if ("resolution_notes" in input) patch.resolution_notes = clampStr(input.resolution_notes, 5000)
  if ("assigned_to" in input) patch.assigned_to = input.assigned_to ?? null
  if ("due_at" in input) patch.due_at = input.due_at ?? null

  if (Object.keys(patch).length === 0) return { request: existing, statusChange: null }

  const { data, error } = await db
    .from("dsar_requests")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select("*")
    .single()
  if (error) {
    console.log("[v0] updateDsar failed:", error.message)
    throw new Error("failed to update DSAR request")
  }
  return { request: data as DsarRequest, statusChange }
}
