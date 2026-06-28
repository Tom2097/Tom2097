export type IntelligenceEventType =
  | "compliance.cert_expiring"
  | "compliance.gap_detected"
  | "compliance.capa_created"
  | "resources.low_stock"
  | "resources.maintenance_due"
  | "resources.asset_offline"
  | "crm.deal_at_risk"
  | "crm.pipeline_stalled"
  | "performance.anomaly_detected"
  | "performance.threshold_breached"
  | "operational.bottleneck_detected"
  | "operational.throughput_drop"

export interface IntelligenceFinding {
  id: string
  organizationId: string
  type: IntelligenceEventType
  title: string
  description: string
  impactScore: number
  confidence: number
  status: "active" | "resolved" | "dismissed"
  detectedAt: Date
  sourceModule: string
  entityId?: string
  monetaryRisk?: number
  suggestedAction?: string
  requiresApproval: boolean
  causalChain?: CausalLink[]
  evidence?: Record<string, unknown>
}

export interface CausalLink {
  fromEntity: string
  fromModule: string
  toEntity: string
  toModule: string
  relationship: string
  monetaryImpact?: number
  timestamp: Date
}

export interface OperationalEntity {
  id: string
  organizationId: string
  type: "certificate" | "instrument" | "asset" | "batch" | "deal" | "document" | "compliance_gap" | "resource"
  name: string
  status: string
  module: string
  properties: Record<string, unknown>
  relatedEntities: EntityRelation[]
  lastUpdated: Date
}

export interface EntityRelation {
  targetId: string
  targetType: string
  relationship: string
  direction: "outbound" | "inbound"
}

export interface ImpactScore {
  finding: IntelligenceFinding
  monetaryValue: number
  urgency: number
  severity: "critical" | "high" | "medium" | "low"
  affectedModules: string[]
  propagationDepth: number
}

export interface ConfidenceThreshold {
  level: "auto" | "suggest" | "ask" | "escalate"
  minConfidence: number
  description: string
}

export interface AgentAction {
  id: string
  agentId: string
  type: string
  targetEntity: string
  targetModule: string
  config: Record<string, unknown>
  status: "pending_approval" | "approved" | "executing" | "completed" | "failed"
  confidence: number
  requiresApproval: boolean
  executedAt?: Date
  result?: unknown
}

export interface Briefing {
  id: string
  organizationId: string
  date: string
  summary: string
  topFindings: IntelligenceFinding[]
  metrics: BriefingMetric[]
  actionItems: BriefingAction[]
  generatedAt: Date
}

export interface BriefingMetric {
  label: string
  value: number
  change: number
  trend: "up" | "down" | "stable"
}

export interface BriefingAction {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  module: string
  findingId?: string
}

export interface MonitorCheck {
  module: string
  lastChecked: Date
  findings: number
  status: "healthy" | "warning" | "critical"
}

export const CONFIDENCE_THRESHOLDS: ConfidenceThreshold[] = [
  { level: "auto", minConfidence: 0.9, description: "Execute without approval" },
  { level: "suggest", minConfidence: 0.7, description: "Suggest to user, execute on consent" },
  { level: "ask", minConfidence: 0.4, description: "Ask user for direction" },
  { level: "escalate", minConfidence: 0, description: "Escalate to human operator" },
]
