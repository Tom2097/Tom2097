// Type definitions for analytics module

import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Represents a single data point in analytics
 */
export interface DataPoint {
  timestamp: string
  value: number
  metadata?: Record<string, unknown>
}

/**
 * Represents file data for upload and processing
 */
export interface FileData {
  id: string
  name: string
  type: string
  size: number
  content: string | ArrayBuffer
  metadata?: Record<string, unknown>
}

/**
 * Criteria for segmenting analytics data
 */
export interface SegmentCriteria {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'in' | 'contains'
  value: unknown
}

/**
 * Represents a tracked event in the system
 */
export interface TrackedEvent {
  id: string
  organizationId: string
  userId?: string
  eventName: string
  eventType: string
  timestamp: string
  properties: Record<string, unknown>
  metadata?: Record<string, unknown>
}

/**
 * Response for file upload operations
 */
export interface FileUploadResponse {
  success: boolean
  fileId: string
  filename: string
  fileType: string
  fileSize: number
  storagePath: string
  url?: string
  error?: string
}

/**
 * Response for listing files
 */
export interface FilesListResponse {
  files: Array<{
    id: string
    filename: string
    fileType: string
    fileSize: number
    uploadedAt: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
  }>
  total: number
  limit: number
  offset: number
}

/**
 * Represents a timeseries data point
 */
export interface TimeseriesPoint {
  bucket: string
  value: number
}

/**
 * Represents a row in a breakdown query
 */
export interface BreakdownRow {
  label: string
  value: number
}

/**
 * Summary statistics for analytics
 */
export interface AnalyticsSummary {
  total_events: number
  unique_users: number
  distinct_events: number
  start_date: string
  end_date: string
}

/**
 * File analysis result
 */
export interface FileAnalysisResult extends Record<string, unknown> {
  fileId: string
  filename: string
  fileType: string
  analysisType: string
  processedAt: string
  processingTime: number
  extractedText?: string
  extractedData?: Array<Record<string, unknown>>
  summary?: string
  keyPoints?: string[]
  entities?: Record<string, unknown>
  sentiment?: Record<string, unknown>
  customResult?: Record<string, unknown>
  modelUsed: string
  tokensUsed: number
  qaPairs?: Array<{
    question: string
    answer: string
    confidence: number
  }>
}

/**
 * Options for file analysis
 */
export interface FileAnalysisOptions {
  analysisType: string
  customPrompt?: string
  questions?: string[]
  extractFields?: string[]
  outputFormat?: 'json' | 'markdown' | 'text'
  includeRawText?: boolean
  maxOutputTokens?: number
  temperature?: number
}

// Export SupabaseClient type for use in analytics modules
export type { SupabaseClient }