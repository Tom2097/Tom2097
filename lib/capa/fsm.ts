export type CapaState = "Open" | "Investigation" | "Action" | "Verification" | "Closed"
export type CapaPriority = "Critical" | "High" | "Medium" | "Low"
export type CapaCategory = "Customer" | "Process" | "Product" | "System" | "Compliance" | "Safety"

interface CapaTransition {
  from: CapaState; to: CapaState; timestamp: Date; by: string; comment?: string
}

export interface CapaRecord {
  id: string; title: string; description: string; category: CapaCategory
  priority: CapaPriority; state: CapaState; organizationId: string
  assignedTo: string; createdBy: string; createdAt: Date; updatedAt: Date
  rootCause?: string; actionPlan?: string; verificationResult?: string
  closureNotes?: string; dueDate?: Date; transitions: CapaTransition[]
}

const VALID_TRANSITIONS: Record<CapaState, CapaState[]> = {
  Open: ["Investigation"],
  Investigation: ["Action", "Open"],
  Action: ["Verification", "Investigation"],
  Verification: ["Closed", "Action"],
  Closed: [],
}

export function canTransition(from: CapaState, to: CapaState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function transitionCapa(
  record: CapaRecord,
  to: CapaState,
  by: string,
  comment?: string
): { success: boolean; reason?: string; updated?: CapaRecord } {
  if (!canTransition(record.state, to)) {
    return { success: false, reason: `Cannot transition from ${record.state} to ${to}` }
  }

  const transition: CapaTransition = { from: record.state, to, timestamp: new Date(), by, comment }
  const updated: CapaRecord = {
    ...record,
    state: to,
    updatedAt: new Date(),
    transitions: [...record.transitions, transition],
  }
  return { success: true, updated }
}

export function createCapa(
  title: string, description: string, category: CapaCategory,
  priority: CapaPriority, organizationId: string, createdBy: string,
  assignedTo: string, dueDate?: Date
): CapaRecord {
  return {
    id: `capa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title, description, category, priority, state: "Open",
    organizationId, assignedTo, createdBy,
    createdAt: new Date(), updatedAt: new Date(),
    dueDate, transitions: [],
  }
}
