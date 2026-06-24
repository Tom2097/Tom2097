/**
 * Module #12: Document Management types.
 * Bytes live in the private Supabase Storage bucket "documents"; these rows
 * hold metadata only. Everything is tenant-scoped by organization_id.
 */

export const DOCUMENT_BUCKET = "documents"

export const DOCUMENT_STATUSES = ["pending", "ready", "archived", "legal_hold"] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export interface DocumentFolder {
  id: string
  organization_id: string
  parent_id: string | null
  name: string
  created_by: string | null
  created_at: string
}

export interface DocumentRecord {
  id: string
  organization_id: string
  folder_id: string | null
  name: string
  description: string | null
  storage_path: string
  mime_type: string
  size_bytes: number
  current_version: number
  status: DocumentStatus
  tags: string[]
  metadata: Record<string, unknown>
  classification: string | null
  summary: string | null
  extracted_entities: Record<string, unknown> | null
  legal_hold: boolean
  legal_hold_at: string | null
  legal_hold_by: string | null
  signature_status: "none" | "pending" | "signed" | "rejected"
  signature_request_id: string | null
  signed_at: string | null
  signed_by: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export interface DocumentVersion {
  id: string
  organization_id: string
  document_id: string
  version: number
  storage_path: string
  mime_type: string
  size_bytes: number
  uploaded_by: string | null
  created_at: string
}

/** Payload to begin an upload: we mint a storage path + signed upload URL. */
export interface CreateUploadInput {
  name: string
  mimeType?: string
  sizeBytes?: number
  folderId?: string | null
  description?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

/** Returned to the client so it can PUT the bytes directly to storage. */
export interface UploadTicket {
  documentId: string
  storagePath: string
  token: string
  signedUrl: string
}

export interface DocumentUpdate {
  name?: string
  description?: string | null
  folderId?: string | null
  tags?: string[]
  status?: DocumentStatus
  metadata?: Record<string, unknown>
  classification?: string | null
  summary?: string | null
  extracted_entities?: Record<string, unknown> | null
  legal_hold?: boolean
  signature_status?: "none" | "pending" | "signed" | "rejected"
  signature_request_id?: string | null
}

export interface SignatureRequest {
  id: string
  document_id: string
  organization_id: string
  requester_id: string
  signer_email: string
  signer_name: string | null
  status: "pending" | "sent" | "signed" | "rejected" | "expired"
  signed_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface ListDocumentsOptions {
  folderId?: string | null
  status?: DocumentStatus
  tag?: string
  search?: string
  legalHold?: boolean | null
  limit: number
  offset: number
}
