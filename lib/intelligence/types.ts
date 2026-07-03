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