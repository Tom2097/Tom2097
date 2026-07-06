export interface SignatureRequest {
  id: string
  documentId: string
  documentName: string
  signerEmail: string
  signerName: string
  status: 'pending' | 'signed' | 'declined' | 'expired'
  sentAt: string
  signedAt?: string
  ipAddress?: string
  auditTrail: SignatureAuditEntry[]
}

export interface SignatureAuditEntry {
  timestamp: string
  action: 'sent' | 'viewed' | 'signed' | 'declined' | 'expired'
  user: string
  ipAddress: string
  details: string
}

export interface Part11Compliance {
  recordId: string
  signatureRequestId: string
  userId: string
  signedHash: string
  timestamp: string
  meaning: 'signed_under_21_cfr_part_11'
  bindingHash: string
  valid: boolean
}

const STORE = new Map<string, SignatureRequest>()
const COMPLIANCE_STORE = new Map<string, Part11Compliance>()

function generateId(): string {
  return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function computeHash(data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

export function createSignatureRequest(
  docId: string,
  docName: string,
  signerEmail: string,
  signerName: string,
): SignatureRequest {
  const id = generateId()
  const now = new Date().toISOString()
  const request: SignatureRequest = {
    id,
    documentId: docId,
    documentName: docName,
    signerEmail,
    signerName,
    status: 'pending',
    sentAt: now,
    auditTrail: [{
      timestamp: now,
      action: 'sent',
      user: signerName,
      ipAddress: '0.0.0.0',
      details: `Signature request sent to ${signerEmail}`,
    }],
  }
  STORE.set(id, request)
  return request
}

export function signDocument(requestId: string, userId: string, ipAddress: string): Part11Compliance {
  const request = STORE.get(requestId)
  if (!request) throw new Error('Signature request not found')
  if (request.status !== 'pending') throw new Error('Signature request is not pending')

  const now = new Date().toISOString()
  const signedHash = computeHash(`${request.documentId}|${request.signerEmail}|${now}`)
  const bindingHash = computeHash(`${signedHash}|${requestId}|${userId}`)
  const recordId = generateId()

  request.status = 'signed'
  request.signedAt = now
  request.ipAddress = ipAddress
  request.auditTrail.push({
    timestamp: now,
    action: 'signed',
    user: request.signerName,
    ipAddress,
    details: 'Document signed under 21 CFR Part 11',
  })

  const record: Part11Compliance = {
    recordId,
    signatureRequestId: requestId,
    userId,
    signedHash,
    timestamp: now,
    meaning: 'signed_under_21_cfr_part_11',
    bindingHash,
    valid: true,
  }
  COMPLIANCE_STORE.set(recordId, record)
  return record
}

export function declineSignature(requestId: string, reason: string): void {
  const request = STORE.get(requestId)
  if (!request) throw new Error('Signature request not found')
  if (request.status !== 'pending') throw new Error('Signature request is not pending')

  const now = new Date().toISOString()
  request.status = 'declined'
  request.auditTrail.push({
    timestamp: now,
    action: 'declined',
    user: request.signerName,
    ipAddress: '0.0.0.0',
    details: reason || 'No reason provided',
  })
}

export function verifySignature(recordId: string): boolean {
  const record = COMPLIANCE_STORE.get(recordId)
  if (!record) return false
  const expectedBinding = computeHash(`${record.signedHash}|${record.signatureRequestId}|${record.userId}`)
  const valid = expectedBinding === record.bindingHash
  record.valid = valid
  return valid
}

export function getSignatureRequests(_orgId: string): SignatureRequest[] {
  return Array.from(STORE.values())
}

export function getSignatureRequestById(requestId: string): SignatureRequest | undefined {
  return STORE.get(requestId)
}

export function getAuditTrail(requestId: string): SignatureAuditEntry[] {
  const request = STORE.get(requestId)
  return request?.auditTrail ?? []
}
