export type WorkflowRunStatus =
  | "running"
  | "awaiting_human"
  | "resumed"
  | "escalated"
  | "expired"
  | "cancelled"
  | "completed"
  | "failed"

export interface WorkflowRun {
  id: string
  organization_id: string
  workflow_type: string
  status: WorkflowRunStatus
  context: Record<string, unknown>
  current_step_key: string | null
  triggered_by: string | null
  created_at: string
  updated_at: string
}

export type HarType = "approve" | "provide_data" | "decide" | "verify" | "acknowledge"
export type TriggerClass = "capability_gap" | "authority_gate"
export type HarPriority = "low" | "normal" | "high" | "urgent"
export type HarStatus = "open" | "notified" | "acted" | "escalated" | "expired" | "cancelled"
export type HarDecision = "approve" | "reject" | "edit" | "request_info" | "delegate" | "escalate"

/** profiles.role's real, enforced values (20260825000000_owner_role.sql). */
export type AssignableRole = "owner" | "admin" | "member" | "viewer"

export interface HarOption {
  label: string
  value: string
  consequence?: string
}

export interface AiRecommendation {
  action: string
  confidence: number
  rationale?: string
}

export interface HumanActionRequest {
  id: string
  organization_id: string
  workflow_run_id: string | null
  step_key: string | null
  type: HarType
  trigger_class: TriggerClass
  reason: string
  context_summary: string | null
  requested_of: string | null
  options: HarOption[]
  ai_recommendation: AiRecommendation | null
  triggered_by: string | null
  assignee_role: AssignableRole | null
  assignee_user_id: string | null
  priority: HarPriority
  due_at: string | null
  sla_hours: number | null
  status: HarStatus
  channel_used: string | null
  decision: HarDecision | null
  reason_given: string | null
  created_at: string
  notified_at: string | null
  acted_at: string | null
  acted_by: string | null
}

export interface HarAssignment {
  id: string
  har_id: string
  organization_id: string
  assigned_role: string | null
  assigned_user_id: string | null
  assigned_by: string | null
  hop_type: "initial" | "delegation" | "escalation" | "fallback"
  reason: string | null
  created_at: string
}

export interface HarAction {
  id: string
  har_id: string
  organization_id: string
  actor_id: string
  action: HarDecision
  reason: string | null
  channel: string
  created_at: string
}
