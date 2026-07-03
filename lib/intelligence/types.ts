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

export const CONFIDENCE_THRESHOLDS: ConfidenceThreshold[] = [
  { level: "auto", minConfidence: 0.8, description: "Auto-execute" },
  { level: "review", minConfidence: 0.5, description: "Review recommended" },
  { level: "manual", minConfidence: 0, description: "Manual action required" },
]