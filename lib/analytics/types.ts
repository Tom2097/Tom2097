export interface FileData {
  id: string
  name: string
  size: number
  type: string
  created_at: string
  [key: string]: unknown
}

export interface Insight {
  id: string
  title: string
  description: string
  category: string
  confidence: number
  [key: string]: unknown
}

export interface DataPoint {
  id: string
  value: number | string
  timestamp?: string
  [key: string]: unknown
}

export interface QueryResult {
  rows?: Array<Record<string, unknown>>
  summary?: Record<string, unknown>
  points?: DataPoint[]
  [key: string]: unknown
}

export interface SegmentCriteria {
  field: string
  operator: string
  value: unknown
  [key: string]: unknown
}