export interface Deal {
  id: string
  name: string
  value: number
  stage: string
  probability: number
  close_date?: string
  [key: string]: unknown
}

export interface Batch {
  id: string
  name: string
  throughput: number
  expected_throughput?: number
  [key: string]: unknown
}

export interface Finding {
  id: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  monetary_risk: number
  [key: string]: unknown
}

export interface InventoryItem {
  id: string
  name: string
  quantity: number
  [key: string]: unknown
}

export interface ConfidenceThreshold {
  level: "auto" | "review" | "manual"
  minConfidence: number
  description: string
}

export interface OperationalEntity {
  id: string
  organizationId: string
  type: string
  name: string
  status: string
  module: string
  properties: Record<string, unknown>
  lastUpdated?: Date
  relatedEntities?: GraphRelation[]
}

export interface EntityRelation {
  targetId: string
  type: string
  confidence: number
  monetary_impact?: number
  relationship?: string
}

export interface GraphRelation {
  targetId: string
  targetType: string
  relationship: string
  direction: 'outbound' | 'inbound'
}

export interface EntityGraphResult {
  entity: OperationalEntity
  relations: GraphRelation[]
}

export interface MonitorCheck {
  module: string
  lastChecked: Date
  findings: number
  status: 'healthy' | 'warning' | 'critical'
}

export interface IntelligenceFinding {
  id: string
  title: string
  description: string
  monetaryRisk: number
  sourceModule: string
  type: string
  detectedAt: Date
  impactScore: number
  entityId?: string
  organizationId?: string
  confidence?: number
  status?: string
  suggestedAction?: string
  requiresApproval?: boolean
  evidence?: Record<string, unknown>
  causalChain?: Array<{ fromModule: string; toModule: string }>
}

export interface ImpactScore {
  finding: IntelligenceFinding
  monetaryValue: number
  urgency: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  affectedModules: string[]
  propagationDepth: number
}

export const CONFIDENCE_THRESHOLDS: ConfidenceThreshold[] = [
  { level: "auto", minConfidence: 0.8, description: "Auto-execute" },
  { level: "review", minConfidence: 0.5, description: "Review recommended" },
  { level: "manual", minConfidence: 0, description: "Manual action required" },
]