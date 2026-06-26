import { createHash } from "crypto"

export interface AuditEntry {
  id: string; tableName: string; recordId: string; action: "INSERT" | "UPDATE" | "DELETE"
  oldData: Record<string, unknown> | null; newData: Record<string, unknown> | null
  changedBy: string; changedAt: Date; hash: string; previousHash: string | null
  organizationId: string; metadata?: Record<string, unknown>
}

export function computeHash(entry: Omit<AuditEntry, "hash" | "id">): string {
  const content = `${entry.previousHash || "genesis"}|${entry.tableName}|${entry.recordId}|${entry.action}|${JSON.stringify(entry.oldData)}|${JSON.stringify(entry.newData)}|${entry.changedBy}|${entry.changedAt.toISOString()}|${entry.organizationId}`
  return createHash("sha256").update(content).digest("hex")
}

export function verifyChain(entries: AuditEntry[]): { valid: boolean; brokenAt?: number } {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const { hash: _, id: _id, ...rest } = entry
    const expectedHash = computeHash(rest as any)
    if (entry.hash !== expectedHash) return { valid: false, brokenAt: i }
    if (i > 0 && entry.previousHash !== entries[i - 1].hash) return { valid: false, brokenAt: i }
  }
  return { valid: true }
}

export function createAuditEntry(
  tableName: string, recordId: string, action: "INSERT" | "UPDATE" | "DELETE",
  oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null,
  changedBy: string, organizationId: string,
  previousEntry?: AuditEntry
): AuditEntry {
  const previousHash = previousEntry?.hash || null
  const entry: Omit<AuditEntry, "hash" | "id"> = {
    tableName, recordId, action, oldData, newData, changedBy,
    changedAt: new Date(), previousHash, organizationId,
  }
  return {
    ...entry,
    id: `audit-${crypto.randomUUID()}`,
    hash: computeHash(entry),
  } as AuditEntry
}